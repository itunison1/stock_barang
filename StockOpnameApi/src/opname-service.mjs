const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SERIAL = /^K[A-Z0-9]{7}$/;

export class HttpError extends Error {
  constructor(status, message, code = 'INVALID_REQUEST') {
    super(message);
    this.status = status;
    this.code = code;
  }
}

const requiredUuid = (value) => {
  if (typeof value !== 'string' || !UUID.test(value)) throw new HttpError(400, 'client_request_id UUID wajib.', 'INVALID_REQUEST');
  return value;
};

const serialOf = (value) => {
  const serial = typeof value === 'string' ? value.trim().toUpperCase() : '';
  if (!SERIAL.test(serial)) throw new HttpError(400, 'Serial harus K + 7 karakter base-36.', 'INVALID_SERIAL');
  return serial;
};

const timeOf = (value) => {
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) throw new HttpError(400, 'scanned_at tidak valid.', 'INVALID_TIME');
  return date;
};

/** Business rules independent from MySQL; repository owns transaction/locking. */
export class OpnameService {
  constructor(repository, now = () => new Date()) {
    this.repository = repository;
    this.now = now;
  }

  async createSession({ divisi, device_name = '', note = '' }) {
    const location = String(divisi || '').trim().toUpperCase();
    if (!location) throw new HttpError(400, 'divisi wajib.', 'INVALID_LOCATION');
    return this.repository.createOrGetOpenSession({ divisi: location, deviceName: String(device_name).slice(0, 50), note: String(note).slice(0, 255) });
  }

  async session(id) {
    const row = await this.repository.getSession(Number(id));
    if (!row) throw new HttpError(404, 'Sesi opname tidak ditemukan.', 'SESSION_NOT_FOUND');
    return row;
  }

  async scan(sessionId, body) {
    const clientRequestId = requiredUuid(body?.client_request_id);
    const serial = serialOf(body?.serial);
    const scannedAt = timeOf(body?.scanned_at);
    const session = await this.session(sessionId);
    if (session.status !== 'OPEN') throw new HttpError(409, 'Sesi sudah closed; scan ditolak.', 'SESSION_CLOSED');

    const priorRequest = await this.repository.getDetailByRequest(clientRequestId);
    if (priorRequest) return { ...priorRequest, idempotent: true };

    const duplicate = await this.repository.getDetailBySessionSerial(session.id, serial);
    if (duplicate) return { result: 'DUPLICATE', detail: duplicate, idempotent: true };

    const unit = await this.repository.findUnitBySerial(serial);
    const result = !unit ? 'UNKNOWN'
      : !['IN_STOCK', 'PARTIAL'].includes(unit.status) ? 'INACTIVE'
      : unit.divisi === session.divisi ? 'MATCH'
      : 'WRONG_LOCATION';

    const detail = await this.repository.insertScan({
      opnameId: session.id,
      clientRequestId,
      serial,
      unit,
      actualDivisi: session.divisi,
      result,
      scannedAt,
    });
    return { result, detail, idempotent: false };
  }

  async summary(id) {
    const session = await this.session(id);
    return this.repository.summary(session.id);
  }

  async close(id, clientRequestId) {
    requiredUuid(clientRequestId);
    const session = await this.session(id);
    if (session.status === 'CLOSED') return { ...(await this.repository.summary(session.id)), idempotent: true };
    return this.repository.closeWithMissing(session.id, this.now());
  }
}
