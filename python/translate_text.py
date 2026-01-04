#!/usr/bin/env python3
"""
Translation script using LibreTranslate API (free and offline-capable)
Falls back to googletrans if needed
"""
import sys
import json
import requests

def translate_texts_libretranslate(texts, target_language):
    """Translate using LibreTranslate API"""
    # Language code mapping for LibreTranslate
    language_map = {
        'my': 'my',      # Burmese
        'en': 'en',      # English
        'th': 'th',      # Thai
        'zh': 'zh',      # Chinese
        'ja': 'ja',      # Japanese
        'ko': 'ko',      # Korean
        'vi': 'vi',      # Vietnamese
        'es': 'es',      # Spanish
        'fr': 'fr',      # French
        'de': 'de',      # German
        'pl': 'pl',      # Polish
    }
    
    lang_code = language_map.get(target_language, target_language)
    
    try:
        translations = []
        for text in texts:
            if not text or not isinstance(text, str):
                translations.append(text)
                continue
            
            try:
                # Try LibreTranslate API
                response = requests.post(
                    'https://libretranslate.de/translate',
                    json={
                        'q': text,
                        'source': 'auto',
                        'target': lang_code,
                        'format': 'text'
                    },
                    timeout=10
                )
                
                if response.status_code == 200:
                    result = response.json()
                    translated_text = result.get('translatedText', text)
                    translations.append(translated_text)
                else:
                    print(f"LibreTranslate error for text '{text}': {response.status_code}", file=sys.stderr)
                    translations.append(text)
            except Exception as e:
                print(f"Translation error for text '{text}': {str(e)}", file=sys.stderr)
                translations.append(text)
        
        return {"translations": translations}
    except Exception as e:
        print(f"Translation service error: {str(e)}", file=sys.stderr)
        return {"error": str(e)}

def translate_texts_googletrans(texts, target_language):
    """Fallback translation using googletrans"""
    try:
        from googletrans import Translator
    except ImportError:
        return {"error": "googletrans library not installed"}
    
    language_map = {
        'my': 'my', 'en': 'en', 'th': 'th', 'zh': 'zh-CN',
        'ja': 'ja', 'ko': 'ko', 'vi': 'vi', 'es': 'es',
        'fr': 'fr', 'de': 'de', 'pl': 'pl',
    }
    
    lang_code = language_map.get(target_language, target_language)
    
    try:
        translator = Translator()
        translations = []
        
        for text in texts:
            if not text or not isinstance(text, str):
                translations.append(text)
                continue
            
            try:
                result = translator.translate(text, dest_language=lang_code)
                translated_text = result.text if hasattr(result, 'text') else result.get('text', text)
                translations.append(translated_text)
            except Exception as e:
                print(f"googletrans error for text '{text}': {str(e)}", file=sys.stderr)
                translations.append(text)
        
        return {"translations": translations}
    except Exception as e:
        print(f"googletrans service error: {str(e)}", file=sys.stderr)
        return {"error": str(e)}

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print(json.dumps({"error": "Usage: translate_text.py <json_texts> <target_language>"}), file=sys.stderr)
        sys.exit(1)
    
    try:
        texts = json.loads(sys.argv[1])
        target_language = sys.argv[2]
        
        # Try LibreTranslate first (better for Myanmar)
        result = translate_texts_libretranslate(texts, target_language)
        
        # If LibreTranslate fails, fallback to googletrans
        if 'error' in result:
            print(f"LibreTranslate failed: {result['error']}, trying googletrans...", file=sys.stderr)
            result = translate_texts_googletrans(texts, target_language)
        
        print(json.dumps(result))
    except json.JSONDecodeError as e:
        print(json.dumps({"error": f"Invalid JSON input: {str(e)}"}), file=sys.stderr)
        sys.exit(1)
    except Exception as e:
        print(json.dumps({"error": str(e)}), file=sys.stderr)
        sys.exit(1)

