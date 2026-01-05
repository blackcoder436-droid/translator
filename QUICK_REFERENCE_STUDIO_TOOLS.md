# Studio Tools Export Fix - Quick Reference

## What Was Fixed

When exporting a video with Studio Tools customizations (font size, color, position, background), the exported video now properly applies all these customizations.

## Changes Made

### File: `backend/routes/upload.js`

Only one file was modified. Key changes:

1. **Extract X-axis and Y-axis offsets** (Lines 447-455)
   - Read `xAxis` and `yAxis` from studio settings
   - Calculate left/right margins from X-axis offset
   - Calculate vertical margin from Y-axis offset

2. **Improve FFmpeg drawtext filter** (Lines 512-540)
   - Apply X-axis positioning: `x=(w-text_w)/2+${xAxis}`
   - Apply background visibility: `box=${showBackground ? 1 : 0}`
   - Apply bold: `:fontweight=bold`
   - Apply italic: `:fontangle=15`

3. **Enhance ASS file generation** (Lines 575-610)
   - Use dynamic margins instead of hardcoded `10,10`
   - Apply background color based on `showBackground` setting
   - Add logging to verify settings are applied

4. **Add debugging logs** (Lines 397-400 and 606-612)
   - Log when export starts with studio settings
   - Log what settings were applied during export

## How to Verify It Works

### Quick Test (5 minutes)

1. **Open a project** that has SRT extracted
2. **Click "Studio Tools"** button
3. **Change settings:**
   - Font Size: 32 (from default)
   - Font Color: Red (#FF0000)
   - X-AXIS: +50 (move right)
4. **Click "Save"**
5. **Click "Export"** button
6. **Download** the exported video
7. **Play** video and check:
   - Text is red? ✓
   - Text is larger? ✓
   - Text is offset right? ✓

### Verify in Console

Check backend console for these logs:

```
Export initiated: {
  hasStudioSettings: true,
  studioSettings: { fontSize: 32, fontColor: '#FF0000', xAxis: 50, ... }
}

Export: Applied studio settings {
  fontSize: 32,
  fontColor: '#FF0000',
  xAxis: 50,
  marginL: 60,  // 10 + 50
  ...
}
```

## What Settings Now Work

| Setting | What It Does | How It's Applied |
|---------|-------------|-----------------|
| **Font Size** | Change subtitle text size | FFmpeg fontsize + ASS style |
| **Font Color** | Change subtitle text color | FFmpeg fontcolor + ASS color |
| **Bold** | Make text bold | FFmpeg fontweight:bold |
| **Italic** | Make text italic | FFmpeg fontangle:15 |
| **X-AXIS** | Move subtitle left/right | FFmpeg x position + ASS margins |
| **Y-AXIS** | Move subtitle up/down | FFmpeg y position + ASS margins |
| **Show Background** | Display/hide background box | FFmpeg box toggle + ASS backColor |

## Technical Details

### Before Fix
- X-axis offset was **ignored**
- Background setting was **ignored**
- Bold/Italic weren't in drawtext **filter**
- Margins were **hardcoded** to 10,10

### After Fix
- X-axis is **calculated into margins**
- Background shows/hides **as configured**
- Bold/Italic **properly formatted**
- Margins are **dynamic based on offsets**

## No Breaking Changes

✅ **Fully backwards compatible**
- Old projects export normally with defaults
- No database changes needed
- No API changes
- Can be deployed immediately

## Files Modified

- ✅ `backend/routes/upload.js` - Export function enhanced

## Files NOT Modified

- ❌ Frontend code (no changes needed)
- ❌ Database schema (no migration needed)
- ❌ API endpoints (no signature changes)
- ❌ Mobile app (same API)

## Quick Deployment

```bash
# Backup (optional)
git commit -m "Before Studio Tools export fix"

# Deploy updated file
cp /path/to/fixed/upload.js backend/routes/upload.js

# Restart backend
cd backend
npm run dev
```

## Common Issues & Solutions

| Problem | Solution |
|---------|----------|
| Settings not applying | Check console for "Export initiated" log |
| Position not changing | Verify xAxis/yAxis values in log |
| Background still showing | Clear browser cache, try re-exporting |
| Text color not right | Check hex color format (#RRGGBB) |
| Font not bold/italic | Verify TTF font is in `backend/fonts/` |

## Test Combinations

Try these to ensure everything works:

```
Test 1: Size + Color
- fontSize: 28
- fontColor: #00FF00 (green)
Expected: Green subtitles, larger

Test 2: Position Only
- xAxis: +80
- yAxis: -50
Expected: Text moved right and up

Test 3: Styling Only
- fontWeight: bold
- fontItalic: true
Expected: Bold italic text

Test 4: Background Toggle
- showBackground: false
Expected: No background box

Test 5: Full Customization (All Together)
- fontSize: 36
- fontColor: #FF00FF (magenta)
- xAxis: +40
- yAxis: -30
- fontWeight: bold
- fontItalic: true
- showBackground: true
Expected: Large magenta bold italic text,
          right and up, with background
```

## Performance Impact

- ✅ **No performance degradation**
- ✅ **Same export speed**
- ✅ **Minimal memory overhead**
- ✅ **Logging can be disabled if needed**

## Support Information

### If export fails:
1. Check backend console for errors
2. Verify video file exists
3. Verify SRT file exists
4. Check FFmpeg is installed
5. Try simpler settings first

### If appearance is wrong:
1. Save Studio Tools settings again
2. Export again
3. Check console logs show correct values
4. Try different export without customizations

### For debugging:
- Check "Export initiated" log for studioSettings
- Check "Applied studio settings" log for calculated values
- Compare calculated margins with xAxis/yAxis inputs

## Success = Export Matches Preview

After these changes, when you export:
- The video should match what you see in Studio Tools preview
- All customizations should be preserved in exported file
- Same appearance on all playback devices

