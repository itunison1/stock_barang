import assert from 'node:assert/strict';
import test from 'node:test';
import { OpnameService } from '../src/opname-service.mjs';

const uuid = (last) => `00000000-0000-4000-8000-00000000000${last}`;

class FakeRepository {
  constructor() {
    this.sessions = [{ id: 1, nomor: 'OPN-000001', divisi: 'G01', status: 'OPEN' }];
    this.details = [];
    this.units = new Map([
      ['K0000001', { id: 11, serial: 'K0000001', itcode: 'CM8H03000', divisi: 'G01', status: 'IN_STOCK' }],
      ['K0000002', { id: 12, serial: 'K0000002', itcode: 'CM8H03000', divisi: 'G02', status: 'IN_STOCK' }],
      ['K0000003', { id: 13, serial: 'K0000003', itcode: 'CM8H03000', divisi: 'G01', status: 'CLOSED' }],
    ]);
  }
  async createOrGetOpenSession(row) { return { ...this.sessions[0], ...row }; }
  async getSession(id) { return this.sessions.find((row) => row.id === id) ?? null; }
  async getDetailByRequest(id) { return this.details.find((row) => row.clientRequestId === id) ?? null; }
  async getDetailBySessionSerial(id, serial) { return this.details.find((row) => row.opnameId === id && row.serial === serial) ?? null; }
  async findUnitBySerial(serial) { return this.units.get(serial) ?? null; }
  async insertScan(row) { const saved = { id: this.details.length + 1, ...row }; this.details.push(saved); return saved; }
  async summary(id) { return { opnameId: id, counts: Object.fromEntries(this.details.filter((row) => row.opnameId === id).map((row) => [row.result, 1])) }; }
  async closeWithMissing(id) { this.sessions[0].status = 'CLOSED'; return { ...(await this.summary(id)), closed: true }; }
}

const scan = (service, requestId, serial) => service.scan(1, { client_request_id: uuid(requestId), serial, scanned_at: '2026-09-21T10:15:30+07:00' });

test('scan classifies exact active serial by location without stock mutation', async () => {
  const repo = new FakeRepository();
  const service = new OpnameService(repo);
  assert.equal((await scan(service, 1, ' k0000001 ')).result, 'MATCH');
  assert.equal((await scan(service, 2, 'K0000002')).result, 'WRONG_LOCATION');
  assert.equal((await scan(service, 3, 'K0000003')).result, 'INACTIVE');
  assert.equal((await scan(service, 4, 'KZZZZZZZ')).result, 'UNKNOWN');
  assert.equal(repo.details.length, 4);
});

test('scan retry and duplicate serial never create second detail', async () => {
  const repo = new FakeRepository();
  const service = new OpnameService(repo);
  assert.equal((await scan(service, 5, 'K0000001')).result, 'MATCH');
  assert.equal((await scan(service, 5, 'K0000001')).idempotent, true);
  assert.equal((await scan(service, 6, 'K0000001')).result, 'DUPLICATE');
  assert.equal(repo.details.length, 1);
});

test('closed session rejects new scan', async () => {
  const repo = new FakeRepository();
  const service = new OpnameService(repo);
  await service.close(1, uuid(7));
  await assert.rejects(() => scan(service, 8, 'K0000001'), { code: 'SESSION_CLOSED' });
});
