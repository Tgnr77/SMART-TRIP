package com.example.app_smart_trip

import android.content.Intent
import android.os.Bundle
import androidx.appcompat.app.AppCompatActivity
import com.example.app_smart_trip.databinding.ActivityLandingBinding

class LandingActivity : AppCompatActivity() {

    private lateinit var binding: ActivityLandingBinding

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityLandingBinding.inflate(layoutInflater)
        setContentView(binding.root)

        // Si déjà connecté, aller directement sur l'app principale
        if (AuthManager.isLoggedIn(this)) {
            goToMain()
            return
        }

        setupButtons()
    }

    private fun setupButtons() {
        // Explorer sans compte → aller sur l'app directement
        binding.btnExplore.setOnClickListener {
            goToMain()
        }

        // Connexion
        binding.btnLogin.setOnClickListener {
            startActivity(Intent(this, LoginActivity::class.java))
        }

        // Créer un compte
        binding.btnRegister.setOnClickListener {
            startActivity(Intent(this, RegisterActivity::class.java))
        }
    }

    private fun goToMain() {
        startActivity(Intent(this, MainActivity::class.java))
        finish()
    }
}
