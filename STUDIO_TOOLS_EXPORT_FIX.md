# Studio Tools Export Fix

## Problem
When exporting a video after using Studio Tools to customize subtitles (font size, color, position, background), the export was not properly applying all the studio settings. The exported video would either:
- Not show the translated subtitles that were displayed in the preview
- Not apply X-axis positioning correctly
- Not respect the background display setting
- Not apply bold/italic formatting correctly in drawtext filter

## Root Causes

1. **Missing X-axis handling**: The `marginL` and `marginR` in ASS files were hardcoded to `10,10` instead of being calculated from the `xAxis` studio setting.

2. **Background setting not used**: The `showBackground` studio setting was ignored in both ASS and drawtext filter generation.

3. **Bold/Italic not applied in drawtext**: The drawtext filter wasn't using the font weight and italic settings from studio tools.

4. **Incomplete studio settings extraction**: Not all studio settings were being read from `project.studioSettings` during export.

## Changes Made

### File: `backend/routes/upload.js`

#### 1. Extract All Studio Settings (Lines 447-455)
```javascript
const studio = project.studioSettings || {};
const fontSize = studio.fontSize || 24;
const fontColor = studio.fontColor || '#FFFFFF';
const fontName = studio.fontName || 'Arial';
const italic = studio.fontItalic ? 1 : 0;
const bold = (studio.fontWeight === 'bold' || ...) ? 1 : 0;
const xAxis = studio.xAxis || 0;                    // NEW
const yAxis = studio.yAxis || 0;                    // NEW
const showBackground = studio.showBackground !== false;  // NEW
const marginL = Math.max(0, 10 + Math.round(xAxis));  // NEW: Use xAxis
const marginR = Math.max(0, 10 - Math.round(xAxis));  // NEW: Use xAxis
```

#### 2. Improved Drawtext Filter (Lines 512-540)
- Calculate X position based on `xAxis` offset: `(w-text_w)/2+${xAxis}`
- Use `showBackground` to control box visibility and styling
- Apply bold and italic using `fontweight` and `fontangle` parameters
- Dynamic box settings based on `showBackground`

```javascript
const boxcolor = showBackground ? 'black@0.6' : 'black@0';
const xPos = xAxis >= 0 ? `(w-text_w)/2+${xAxis}` : `(w-text_w)/2${xAxis}`;
const fontweightStr = bold ? ':fontweight=bold' : '';
const fontangleStr = italic ? ':fontangle=15' : '';
```

#### 3. Enhanced ASS Style Line (Lines 597-598)
- Use calculated `marginL` and `marginR` instead of hardcoded `10,10`
- Dynamic `backColor` based on `showBackground` setting
- Proper color application for background

```javascript
const backColor = showBackground ? '&H000000AA' : '&H00000000';
assLines.push(`Style: Default,...,${marginL},${marginR},${marginV},...`);
```

#### 4. Added Debug Logging
- Log studio settings when export is initiated (line 397)
- Log applied settings during ASS file generation (line 606)

## How It Works Now

1. **User opens a project** and enables Auto-Translate
2. **User customizes in Studio Tools**:
   - Adjusts font size, color
   - Changes position (X-axis, Y-axis)
   - Toggles background on/off
   - Applies bold/italic formatting
   - Saves settings
3. **Frontend saves**:
   - Studio settings to `project.studioSettings`
   - Translated SRT text to database
4. **User clicks Export**
5. **Backend export endpoint**:
   - Fetches project with `studioSettings`
   - Reads translated SRT from disk
   - Creates ASS file with all studio settings applied
   - Uses drawtext filter with proper positioning and formatting
   - Burns subtitles into video with exact Studio Tools appearance
6. **Result**: Video exported with subtitles matching Studio Tools preview

## Testing

To verify the fix works:

1. Upload a video and extract SRT
2. Open project and enable Auto-Translate
3. Open Studio Tools and customize:
   - Change font size to 32px
   - Change color to red (#FF0000)
   - Move X-axis to +50px (right)
   - Move Y-axis to -30px (up)
   - Toggle background OFF
4. Click Save in Studio Tools
5. Click Export button
6. Check that:
   - Subtitles are positioned correctly (offset right and up)
   - Font size matches (32px)
   - Color is red
   - Background is not visible
   - Subtitles are the translated text

## Files Modified

- `backend/routes/upload.js` - Enhanced export function with full studio settings support

## Backwards Compatibility

✅ **Fully backwards compatible**
- If `studioSettings` is empty/missing, uses sensible defaults
- Existing projects without studio settings will still export with default appearance
- No changes to database schema or API contracts
