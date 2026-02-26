package com.example.app_smart_trip

import android.content.Intent
import android.os.Bundle
import android.view.View
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import com.example.app_smart_trip.databinding.ActivityLoginBinding
import kotlinx.coroutines.launch

class LoginActivity : AppCompatActivity() {

    private lateinit var binding: ActivityLoginBinding

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityLoginBinding.inflate(layoutInflater)
        setContentView(binding.root)

        setupButtons()
    }

    private fun setupButtons() {
        binding.btnLogin.setOnClickListener { doLogin() }

        binding.btnGoRegister.setOnClickListener {
            startActivity(Intent(this, RegisterActivity::class.java))
        }
    }

    private fun doLogin() {
        val email    = binding.etEmail.text?.toString()?.trim() ?: ""
        val password = binding.etPassword.text?.toString() ?: ""

        if (email.isEmpty() || password.isEmpty()) {
            showError("Veuillez remplir tous les champs")
            return
        }

        setLoading(true)

        lifecycleScope.launch {
            try {
                val resp = RetrofitClient.api.login(LoginRequest(email, password))
                val body = resp.body()

                if (resp.isSuccessful && body?.success == true) {
                    // Sauvegarder token + user
                    body.token?.let { AuthManager.saveToken(this@LoginActivity, it) }
                    body.user?.let  { AuthManager.saveUser(this@LoginActivity, it) }

                    // Aller sur l'app principale
                    startActivity(Intent(this@LoginActivity, MainActivity::class.java))
                    finishAffinity()
                } else {
                    showError(body?.message ?: "Identifiants incorrects")
                }
            } catch (e: Exception) {
                showError("Erreur réseau : ${e.message}")
            } finally {
                setLoading(false)
            }
        }
    }

    private fun showError(msg: String) {
        binding.tvError.text = msg
        binding.tvError.visibility = View.VISIBLE
    }

    private fun setLoading(loading: Boolean) {
        binding.btnLogin.isEnabled = !loading
        binding.btnLogin.text = if (loading) "Connexion…" else getString(R.string.btn_login_action)
    }
}
