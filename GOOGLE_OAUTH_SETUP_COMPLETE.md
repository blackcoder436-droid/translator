# Google OAuth Setup Guide - Step by Step

## 🚨 အရေးကြီးသော Error: "OAuth client was not found"

ဒီ error ကို ဖြေရှင်းဖို့ Google Cloud Console မှာ အောက်ပါအဆင့်တွေကို လုပ်ရပါမယ်။

## Step 1: Google Cloud Console ကို ဖွင့်ပါ

1. [Google Cloud Console](https://console.cloud.google.com/) ကို သွားပါ
2. သင့်ရဲ့ project ကို ရွေးပါ (သို့မဟုတ် အသစ်တစ်ခု ဖန်တီးပါ)

## Step 2: APIs & Services ကို Enable လုပ်ပါ

1. ဘယ်ဘက် menu မှာ **APIs & Services** → **Library** ကို နှိပ်ပါ
2. Search box မှာ "Google+ API" လို့ ရိုက်ပါ
3. **Google+ API** ကို ရွေးပြီး **Enable** ကို နှိပ်ပါ

## Step 3: OAuth Consent Screen ကို Configure လုပ်ပါ

1. ဘယ်ဘက် menu မှာ **APIs & Services** → **OAuth consent screen** ကို နှိပ်ပါ
2. **User Type** ကို **External** ရွေးပါ
3. **Create** ကို နှိပ်ပါ

### App Information:
- **App name**: Movie Translator
- **User support email**: သင့်ရဲ့ Gmail address ထည့်ပါ

### App domain:
- **Application homepage**: `http://localhost:3000`
- **Application privacy policy**: `http://localhost:3000/privacy` (သို့မဟုတ် ကြိုက်နှစ်သက်ရာ URL)

### Authorized domains:
- `localhost`

### Developer contact information:
- **Email addresses**: သင့်ရဲ့ Gmail address ထည့်ပါ

4. **Save and Continue** ကို နှိပ်ပါ

## Step 4: Scopes ကို Configure လုပ်ပါ

1. **Scopes** page မှာ အောက်ပါ scopes တွေကို ထည့်ပါ:
   - `.../auth/userinfo.email`
   - `.../auth/userinfo.profile`

2. **Save and Continue** ကို နှိပ်ပါ

## Step 5: Test Users ကို ထည့်ပါ (Optional)

1. သင့်ရဲ့ Gmail address ကို test user အဖြစ် ထည့်ပါ
2. **Save and Continue** ကို နှိပ်ပါ

## Step 6: Credentials ကို ဖန်တီးပါ

1. ဘယ်ဘက် menu မှာ **APIs & Services** → **Credentials** ကို နှိပ်ပါ
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
- ဒါတွေကို သင့်ရဲ့ `backend/.env` file မှာ ထည့်ပါ:

```env
GOOGLE_CLIENT_ID=သင့်ရဲ့_client_id_ထည့်ပါ
GOOGLE_CLIENT_SECRET=သင့်ရဲ့_client_secret_ထည့်ပါ
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

2. Browser မှာ `http://localhost:3000/auth/login` ကို သွားပါ
3. "Login with Google" button ကို နှိပ်ပါ

## 🔍 Troubleshooting

### Error: "OAuth client was not found"
- Client ID မှားနေတာလား စစ်ပါ
- OAuth consent screen configure လုပ်ထားရဲ့လား စစ်ပါ
- Google+ API enable လုပ်ထားရဲ့လား စစ်ပါ

### Error: "redirect_uri_mismatch"
- Authorized redirect URIs မှာ `http://localhost:5001/auth/google/callback` ရှိရဲ့လား စစ်ပါ

### Error: "invalid_scope"
- Scopes မှာ email နဲ့ profile ထည့်ထားရဲ့လား စစ်ပါ

## 📝 မှတ်ချက်

- Development အတွက် `localhost` URLs ကိုပဲ သုံးပါ
- Production တင်တဲ့အခါ သင့်ရဲ့ domain URLs ကို ထည့်ရပါမယ်
- Client Secret ကို ဘယ်တော့မှ git မှာ commit မလုပ်ပါနဲ့

## ✅ အောင်မြင်ရင်

Google login အလုပ်လုပ်ပြီဆိုရင်:
- Google account နဲ့ login လုပ်နိုင်ပါမယ်
- User profile ကို ရယူနိုင်ပါမယ်
- JWT token ရပါမယ်

မေးစရာရှိရင် ပြောပါ! 🎯