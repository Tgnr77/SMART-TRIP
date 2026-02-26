package com.example.app_smart_trip

import android.content.Intent
import android.os.Bundle
import android.view.View
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import com.example.app_smart_trip.databinding.ActivityRegisterBinding
import kotlinx.coroutines.launch

class RegisterActivity : AppCompatActivity() {

    private lateinit var binding: ActivityRegisterBinding

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityRegisterBinding.inflate(layoutInflater)
        setContentView(binding.root)

        setupButtons()
    }

    private fun setupButtons() {
        binding.btnRegister.setOnClickListener { doRegister() }

        binding.btnGoLogin.setOnClickListener {
            startActivity(Intent(this, LoginActivity::class.java))
            finish()
        }
    }

    private fun doRegister() {
        val firstName = binding.etFirstName.text?.toString()?.trim() ?: ""
        val lastName  = binding.etLastName.text?.toString()?.trim() ?: ""
        val email     = binding.etEmail.text?.toString()?.trim() ?: ""
        val password  = binding.etPassword.text?.toString() ?: ""

        if (firstName.isEmpty() || lastName.isEmpty() || email.isEmpty() || password.isEmpty()) {
            showError("Veuillez remplir tous les champs")
            return
        }

        if (password.length < 8) {
            showError("Le mot de passe doit contenir au moins 8 caractères")
            return
        }

        setLoading(true)

        lifecycleScope.launch {
            try {
                val resp = RetrofitClient.api.register(
                    RegisterRequest(firstName, lastName, email, password)
                )
                val body = resp.body()

                if (resp.isSuccessful && body?.success == true) {
                    // Compte créé → aller à la connexion
                    android.widget.Toast.makeText(
                        this@RegisterActivity,
                        "Compte créé ! Vérifiez votre email.",
                        android.widget.Toast.LENGTH_LONG
                    ).show()
                    startActivity(Intent(this@RegisterActivity, LoginActivity::class.java))
                    finishAffinity()
                } else {
                    showError(body?.message ?: "Erreur lors de l'inscription")
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
        binding.btnRegister.isEnabled = !loading
        binding.btnRegister.text = if (loading) "Inscription…" else getString(R.string.btn_register_action)
    }
}
