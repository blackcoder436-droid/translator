# Google OAuth Client အသစ်ဖန်တီးနည်း

## Step 1: Google Cloud Console ကို ဖွင့်ပါ

1. [Google Cloud Console](https://console.cloud.google.com/) ကို သွားပါ
2. သင့်ရဲ့ project ကို ရွေးပါ (သို့မဟုတ် အသစ်တစ်ခု ဖန်တီးပါ)

## Step 2: APIs & Services ကို Enable လုပ်ပါ

1. ဘယ်ဘက် menu → **APIs & Services** → **Library** ကို နှိပ်ပါ
2. "Google+ API" လို့ ရှာပါ
3. **Enable** ကို နှိပ်ပါ

## Step 3: OAuth Consent Screen ကို Configure လုပ်ပါ

1. **APIs & Services** → **OAuth consent screen** ကို နှိပ်ပါ
2. **User Type**: **External** ရွေးပါ
3. **Create** ကို နှိပ်ပါ

### App Information:
- **App name**: Movie Translator
- **User support email**: သင့်ရဲ့ Gmail address

### App domain:
- **Application homepage**: `http://localhost:3000`
- **Application privacy policy**: `http://localhost:3000/privacy`

### Authorized domains:
- `localhost`

### Developer contact information:
- **Email addresses**: သင့်ရဲ့ Gmail address

4. **Save and Continue** ကို နှိပ်ပါ

## Step 4: Scopes ကို Configure လုပ်ပါ

1. **Scopes** page မှာ အောက်ပါ scopes ကို ထည့်ပါ:
   - `.../auth/userinfo.email`
   - `.../auth/userinfo.profile`

2. **Save and Continue** ကို နှိပ်ပါ

## Step 5: Test Users ကို ထည့်ပါ (Optional)

1. သင့်ရဲ့ Gmail address ကို test user အဖြစ် ထည့်ပါ
2. **Save and Continue** ကို နှိပ်ပါ

## Step 6: Credentials ကို ဖန်တီးပါ

1. **APIs & Services** → **Credentials** ကို နှိပ်ပါ
2. **+ Create Credentials** → **OAuth client ID** ကို နှိပ်ပါ

### OAuth client ID ဖန်တီးရန်:
- **Application type**: **Web application**
- **Name**: Movie Translator Client

### Authorized JavaScript origins:
```
http://localhost:3000
```

### Authorized redirect URIs:
```
http://localhost:5001/auth/google/callback
```

3. **Create** ကို နှိပ်ပါ

## Step 7: Client ID နဲ့ Client Secret ကို ရယူပါ

OAuth client ဖန်တီးပြီးရင်:
- **Client ID** နဲ့ **Client Secret** ကို ရပါမယ်
- ဒါတွေကို သင့်ရဲ့ `backend/.env` file မှာ update လုပ်ပါ:

```env
GOOGLE_CLIENT_ID=သင့်ရဲ့_အသစ်_client_id
GOOGLE_CLIENT_SECRET=သင့်ရဲ့_အသစ်_client_secret
```

## Step 8: Backend Server ကို Restart လုပ်ပါ

```bash
cd backend
node server.js
```

## Step 9: Test လုပ်ပါ

1. Frontend ကို start လုပ်ပါ:
```bash
cd frontend
npm run dev
```

2. `http://localhost:3000/auth/login` ကို သွားပါ
3. "Login with Google" button ကို နှိပ်ပါ

## ⚠️ အရေးကြီးသော မှတ်ချက်

- **Client ID ဟောင်းကို မသုံးပါနဲ့** - ဖျက်ထားလို့ invalid ဖြစ်နေပါပြီ
- **အသစ် Client ID ကိုပဲ သုံးပါ**
- **Redirect URI ကို မှန်ကန်အောင် ထည့်ပါ**: `http://localhost:5001/auth/google/callback`

## 🔍 ပြဿနာဖြစ်နေရင် စစ်ဆေးရမယ့် အချက်တွေ

1. **OAuth Consent Screen** configure လုပ်ထားရဲ့လား?
2. **Google+ API** enable လုပ်ထားရဲ့လား?
3. **Authorized redirect URIs** မှာ `http://localhost:5001/auth/google/callback` ရှိရဲ့လား?
4. **Client ID နဲ့ Client Secret** က .env file မှာ မှန်ကန်ရဲ့လား?

အဆင်ပြေရင် Google login အလုပ်လုပ်ပါလိမ့်မယ်! 🎯