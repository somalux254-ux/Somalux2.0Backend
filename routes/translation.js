/**
 * Backend Translation Endpoint
 * Add this to your backend/index.js
 * 
 * Installation:
 * npm install google-translate-api-free
 * 
 * Usage:
 * POST /api/translate
 * Body: { text: "Hello", targetLanguage: "Spanish", targetCode: "es" }
 */

const express = require('express');
const router = express.Router();

/**
 * Translation endpoint using free Google Translate API
 * POST /api/translate
 * Body: { text, targetLanguage, targetCode }
 */
router.post('/translate', async (req, res) => {
  try {
    const { text, targetLanguage, targetCode } = req.body;

    if (!text || !targetCode) {
      return res.status(400).json({ 
        error: 'text and targetCode are required' 
      });
    }

    // Validate text length
    if (text.length > 5000) {
      return res.status(400).json({ 
        error: 'Text too long (max 5000 characters)' 
      });
    }

    try {
      // Try using Google Translate free endpoint
      const encodedText = encodeURIComponent(text);
      const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${targetCode}&dt=t&q=${encodedText}`;
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
        timeout: 10000
      });

      if (!response.ok) {
        throw new Error(`Google Translate API error: ${response.status}`);
      }

      const data = await response.json();
      
      // Parse the nested array response from Google Translate
      if (data && data[0] && Array.isArray(data[0])) {
        const translatedParts = data[0].map(item => item[0]).filter(Boolean);
        const translation = translatedParts.join('');
        
        if (translation) {
          console.log(`✅ Backend Translation: "${text.substring(0, 30)}..." → ${targetLanguage}`);
          return res.json({
            success: true,
            translation: translation,
            language: targetLanguage,
            source: 'google_translate_backend'
          });
        }
      }
    } catch (translationError) {
      console.warn('⚠️ Translation API error:', translationError.message);
    }

    // Fallback: Return original text
    return res.json({
      success: false,
      translation: text,
      language: targetLanguage,
      source: 'fallback',
      message: 'Translation service temporarily unavailable'
    });

  } catch (error) {
    console.error('❌ Backend translation error:', error);
    res.status(500).json({ 
      error: 'Translation failed',
      message: error.message
    });
  }
});

module.exports = router;
