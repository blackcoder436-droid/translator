const express = require('express');
const router = express.Router();
const { exec } = require('child_process');
require('dotenv').config();
const axios = require('axios');

// POST /translate - Translate multiple texts using Python script
router.post('/', async (req, res) => {
  try {
    const { texts, targetLanguage, model } = req.body;
    const selectedModel = model || 'libretranslate';
    
    if (!texts || !Array.isArray(texts) || texts.length === 0) {
      return res.status(400).json({ error: 'texts array is required' });
    }
    
    if (!targetLanguage) {
      return res.status(400).json({ error: 'targetLanguage is required' });
    }

    // If the selected model is groq, call Groq API directly
    if (selectedModel === 'groq') {
      try {
        const groqKey = process.env.GROQ_API_KEY;
        if (!groqKey) return res.status(500).json({ error: 'GROQ_API_KEY not configured on server' });

        // Build a single prompt asking Groq to return a JSON array of translations
        // This uses a single-call approach: we send all texts joined and request JSON output
        const joiner = '\n\n---\n\n';
        const inputTexts = texts.map((t, i) => `${i + 1}: ${t.replace(/\n/g, ' ')}`).join('\n');
        const prompt = `Translate the following list of texts into ${targetLanguage}. Respond ONLY with a JSON array of translated strings in order, and nothing else.\n\nTexts:\n${inputTexts}`;

        // Try a few possible Groq endpoints (some variants exist across regions/versions)
        const groqEndpoints = [
          'https://api.groq.com/v1/generate',
          'https://api.groq.ai/v1/models/groq-1/generate',
          'https://api.groq.ai/v1/generate'
        ];
        const payload = {
          model: 'groq-1',
          input: prompt,
          max_output_tokens: 2048
        };

        let groqRes = null;
        let lastErr = null;
        for (const groqEndpoint of groqEndpoints) {
          try {
            groqRes = await axios.post(groqEndpoint, payload, {
              headers: { Authorization: `Bearer ${groqKey}`, 'Content-Type': 'application/json' },
              timeout: 30000
            });
            if (groqRes && groqRes.status >= 200 && groqRes.status < 300) break;
          } catch (e) {
            lastErr = e;
            // continue to next endpoint
            continue;
          }
        }

        if (!groqRes) {
          // Provide more detailed error for debugging
          if (lastErr?.response) {
            console.error('Groq translate HTTP error:', lastErr.response.status, lastErr.response.data);
          } else {
            console.error('Groq translate error (no response):', lastErr?.message || lastErr);
          }
          throw lastErr || new Error('Groq request failed');
        }

        const textOutput = groqRes.data?.output || groqRes.data?.outputs || groqRes.data?.text || JSON.stringify(groqRes.data);
        // Attempt to extract JSON array from the model output
        let parsed = null;
        if (typeof textOutput === 'string') {
          const maybe = (textOutput.match(/\[.*\]/s) || [null])[0];
          if (maybe) {
            try { parsed = JSON.parse(maybe); } catch(e) {}
          }
        } else if (Array.isArray(textOutput)) {
          parsed = textOutput;
        }

        if (!parsed) {
          // Fallback: try to treat the entire response as a single translation per input (split by lines)
          const fallbackText = (typeof textOutput === 'string') ? textOutput.trim() : JSON.stringify(textOutput);
          const lines = fallbackText.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
          const translations = texts.map((t, i) => lines[i] || t);
          return res.json({ translations });
        }

        // Ensure we have same length
        const translations = texts.map((t, i) => (parsed[i] || t));
        return res.json({ translations });
      } catch (err) {
        console.error('Groq translate error:', err?.message || err);
        // fallback to Python script below
      }
    }

    // Call Python translation script (default / fallback)
    const textsJson = JSON.stringify(texts);
    // Escape for command line
    const escapedTexts = textsJson.replace(/"/g, '\\"');
    
    exec(`python ../python/translate_text.py "${escapedTexts}" "${targetLanguage}"`, 
      { timeout: 60000, maxBuffer: 1024 * 1024 * 10, shell: true, encoding: 'utf8' },
      (err, stdout, stderr) => {
        if (err) {
          console.error('Translation error:', err.message);
          console.error('STDERR:', stderr);
          return res.status(500).json({ error: 'Translation failed', details: stderr || err.message });
        }
        
        try {
          const result = JSON.parse(stdout);
          if (result.error) {
            return res.status(500).json(result);
          }
          return res.json(result);
        } catch (parseErr) {
          console.error('Failed to parse Python output:', stdout);
          return res.status(500).json({ error: 'Invalid response from translation service' });
        }
      }
    );
  } catch (error) {
    console.error('Translation route error:', error);
    return res.status(500).json({ error: 'Translation service error' });
  }
});

module.exports = router;
