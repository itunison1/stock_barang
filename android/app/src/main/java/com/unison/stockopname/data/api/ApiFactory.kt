package com.unison.stockopname.data.api

import okhttp3.OkHttpClient
import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory
import java.util.concurrent.TimeUnit

object ApiFactory {
    fun create(baseUrl: String, tokenProvider: () -> String?): WmsApi {
        val client = OkHttpClient.Builder()
            .connectTimeout(8, TimeUnit.SECONDS)
            .readTimeout(30, TimeUnit.SECONDS)
            .writeTimeout(60, TimeUnit.SECONDS)
            .addInterceptor { chain ->
                val token = tokenProvider()
                val request = if (token != null) chain.request().newBuilder().header("X-Auth-Token", token).build()
                else chain.request()
                chain.proceed(request)
            }
            .build()
        return Retrofit.Builder()
            .baseUrl(baseUrl.trimEnd('/') + "/")
            .client(client)
            .addConverterFactory(GsonConverterFactory.create())
            .build()
            .create(WmsApi::class.java)
    }
}
