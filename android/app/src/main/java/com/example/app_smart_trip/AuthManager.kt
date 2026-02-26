package com.example.app_smart_trip

import android.content.Context
import android.content.SharedPreferences

/**
 * Gestionnaire d'authentification — stocke/lit le token JWT et les infos utilisateur
 * en utilisant SharedPreferences.
 */
object AuthManager {

    private const val PREF_NAME = "smart_trip_prefs"
    private const val KEY_TOKEN   = "jwt_token"
    private const val KEY_USER_ID = "user_id"
    private const val KEY_FNAME   = "user_first_name"
    private const val KEY_LNAME   = "user_last_name"
    private const val KEY_EMAIL   = "user_email"

    private fun prefs(context: Context): SharedPreferences =
        context.getSharedPreferences(PREF_NAME, Context.MODE_PRIVATE)

    // ─── Token ───────────────────────────────────────────────────────────────

    fun saveToken(context: Context, token: String) {
        prefs(context).edit().putString(KEY_TOKEN, token).apply()
    }

    fun getToken(context: Context): String? =
        prefs(context).getString(KEY_TOKEN, null)

    /** Retourne "Bearer <token>" pour les headers Authorization */
    fun getBearerToken(context: Context): String =
        "Bearer ${getToken(context) ?: ""}"

    fun isLoggedIn(context: Context): Boolean =
        getToken(context) != null

    // ─── User ────────────────────────────────────────────────────────────────

    fun saveUser(context: Context, user: User) {
        prefs(context).edit()
            .putString(KEY_USER_ID, user.id)
            .putString(KEY_FNAME, user.firstName)
            .putString(KEY_LNAME, user.lastName)
            .putString(KEY_EMAIL, user.email)
            .apply()
    }

    fun getUser(context: Context): User? {
        val p = prefs(context)
        val id = p.getString(KEY_USER_ID, null) ?: return null
        return User(
            id        = id,
            firstName = p.getString(KEY_FNAME, "") ?: "",
            lastName  = p.getString(KEY_LNAME, "") ?: "",
            email     = p.getString(KEY_EMAIL, "") ?: ""
        )
    }

    // ─── Logout ──────────────────────────────────────────────────────────────

    fun logout(context: Context) {
        prefs(context).edit().clear().apply()
    }
}
