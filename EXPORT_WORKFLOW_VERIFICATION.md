# Studio Tools Export - Workflow Verification

## Issue Description
When users translate and customize subtitles using the Studio Tools panel (changing font size, color, position, background), the exported video was not properly reflecting these customizations.

## Solution Overview
The export functionality has been enhanced to properly read and apply all studio settings from the project database and apply them during video export using both FFmpeg's drawtext filter and ASS subtitle format.

## Detailed Workflow

### Frontend (Next.js - `src/app/page.tsx`)

#### Step 1: User Opens Studio Tools
```
Project loaded → User clicks "Studio Tools" button
```
- Studio Tools modal opens with current settings
- State variables: `fontSize`, `fontColor`, `xAxis`, `yAxis`, `fontWeight`, `fontItalic`, `showBackground`
- User adjusts sliders and toggles

#### Step 2: User Saves Settings
```
Click "Save" button in Studio Tools modal
```
- Line 1268-1282 in page.tsx
- Builds payload:
  ```javascript
  {
    srtText: (autoTranslate ? translatedCues : srtCues), // Current subtitle text
    studioSettings: {
      fontSize, fontColor, fontWeight, fontItalic,
      xAxis, yAxis, lineWrap, showBackground,
      selectedLanguage, autoTranslate
    }
  }
  ```
- PUT request to: `http://localhost:5001/api/projects/{id}`
- Saves both translated SRT and studio settings to database

### Backend (Express.js - `routes/upload.js`)

#### Step 3: Backend Receives Studio Settings
```
PUT /api/projects/:id endpoint (Line 296)
```
- Verifies user authentication
- Finds project by ID and userId
- **Writes SRT file** with translated content
- **Updates project document** with `studioSettings`

#### Step 4: User Exports Video
```
Click "Export" button on project
```
- Frontend calls: `POST /api/projects/{id}/export`

#### Step 5: Backend Processes Export
```
POST /api/projects/:id/export endpoint (Line 360)
```

**Verification Steps:**

1. **Log Check (Line 397):**
   ```javascript
   console.log('Export initiated:', {
     projectId: project._id.toString(),
     hasStudioSettings: !!project.studioSettings,
     studioSettings: project.studioSettings
   });
   ```
   Verify `studioSettings` object contains all customizations

2. **Studio Settings Extraction (Lines 447-455):**
   ```javascript
   const studio = project.studioSettings || {};
   const fontSize = studio.fontSize || 24;
   const fontColor = studio.fontColor || '#FFFFFF';
   const fontName = studio.fontName || 'Arial';
   const italic = studio.fontItalic ? 1 : 0;
   const bold = studio.fontWeight === 'bold' ? 1 : 0;
   const xAxis = studio.xAxis || 0;           // ← NEW
   const yAxis = studio.yAxis || 0;           // ← NEW
   const showBackground = studio.showBackground !== false;  // ← NEW
   const marginL = Math.max(0, 10 + Math.round(xAxis));    // ← NEW
   const marginR = Math.max(0, 10 - Math.round(xAxis));    // ← NEW
   ```
   All settings properly extracted

3. **Choose Export Method:**
   - **If TTF font available** → Use FFmpeg drawtext filter (Lines 512-540)
   - **Otherwise** → Use ASS file format (Lines 557-610)

4. **FFmpeg Drawtext Filter (Lines 512-540):**
   ```
   Applies:
   - Font: fontName (resolved from fonts directory)
   - Size: fontSize
   - Color: fontColor (hex to ffmpeg format)
   - Weight: bold (via fontweight parameter) ← NEW
   - Style: italic (via fontangle parameter) ← NEW
   - Position: x=(w-text_w)/2+${xAxis}  ← NEW X-offset
             y=h-${marginV}            ← Y-offset
   - Background: box=${showBackground ? 1 : 0}  ← NEW
                boxcolor=${showBackground ? 'black@0.6' : 'black@0'}  ← NEW
   - Timing: enable='between(t,start,end)'
   ```

5. **ASS File Format (Lines 557-610):**
   ```
   [Script Info]
   PlayResX: {video_width}
   PlayResY: {video_height}
   
   [V4+ Styles]
   Style: Default,
           {fontName},           // Font
           {fontSize},           // Size
           {fontColor},          // Color
           &H000000FF,           // Secondary (unused)
           &H00000000,           // Outline color
           {backColor},          // Background (NEW - dynamic)
           {bold},               // Bold
           {italic},             // Italic
           0,0,100,100,0,0,1,
           {outline},{shadow},
           2,                    // Alignment
           {marginL},            // Left margin (NEW)
           {marginR},            // Right margin (NEW)
           {marginV},            // Vertical margin
           1                     // Encoding
   
   [Events]
   Dialogue: 0,{start},{end},Default,,0,0,0,,{text}
   ```

   **Key improvements:**
   - `marginL` = 10 + xAxis (positions from left)
   - `marginR` = 10 - xAxis (positions from right)
   - `marginV` = 10 + yAxis (positions from bottom)
   - `backColor` = semi-transparent black if showBackground, else transparent

6. **Burn Subtitles:**
   - Either via FFmpeg drawtext: `ffmpeg -i video.mp4 -vf "drawtext=..." output.mp4`
   - Or via ASS filter: `ffmpeg -i video.mp4 -vf "ass=subtitles.ass" output.mp4`

7. **Log Applied Settings (Line 606):**
   ```javascript
   console.log('Export: Applied studio settings', {
     fontSize, fontColor, fontName,
     bold, italic,
     xAxis, yAxis, marginL, marginR, marginV,
     showBackground, backColor, outline, shadow
   });
   ```
   Confirms all settings applied

8. **Return Export URL:**
   ```
   {
     message: 'Export ready',
     url: '/uploads/exports/{projectId}_subtitled.mp4'
   }
   ```

#### Step 6: Download Exported Video
```
GET /api/projects/:id/download
```
- Streams exported video as file attachment
- Browser downloads video with burned subtitles

## Verification Checklist

### Before Running Test:
- [ ] Backend is running (`npm run dev` in backend directory)
- [ ] MongoDB is connected
- [ ] FFmpeg is installed and accessible
- [ ] Optional: TTF font available in `backend/fonts/`

### Test Scenario:

1. **Upload a video** with SRT extraction
2. **Wait for SRT extraction** to complete
3. **Open the project**
4. **Enable Auto-Translate** (Burmese)
5. **Open Studio Tools** and customize:
   - Font Size: 32px
   - Font Color: Red (#FF0000)
   - Bold: ON
   - Italic: ON
   - X-AXIS: +60px
   - Y-AXIS: -40px
   - Show Background: OFF
6. **Click Save** in Studio Tools
   - Check console for: "Saved to project"
7. **Click Export** button
   - Check backend console for:
     - "Export initiated:" log with studioSettings
     - "Export: Applied studio settings" log
8. **Wait for export** to complete
9. **Download the exported video**
10. **Verify in video player**:
    - [ ] Subtitles are red colored
    - [ ] Subtitles are larger (32px)
    - [ ] Subtitles are bold
    - [ ] Subtitles are italic
    - [ ] Subtitles are positioned right (+60px) and up (-40px)
    - [ ] Subtitles have NO background box
    - [ ] Subtitles show translated text (Burmese)

### Expected Console Output:

```
Export initiated: {
  projectId: '...',
  hasStudioSettings: true,
  studioSettings: {
    fontSize: 32,
    fontColor: '#FF0000',
    fontWeight: 'bold',
    fontItalic: true,
    xAxis: 60,
    yAxis: -40,
    showBackground: false,
    ...
  }
}

Export: Applied studio settings {
  fontSize: 32,
  fontColor: '#FF0000',
  fontName: '...',
  bold: 1,
  italic: 1,
  xAxis: 60,
  yAxis: -40,
  marginL: 70,     // 10 + 60
  marginR: -50,    // 10 - 60 (clamped to 0)
  marginV: 50,     // 10 + 40
  showBackground: false,
  backColor: '&H00000000',
  outline: 1,
  shadow: 0
}
```

## Backwards Compatibility

✅ All changes are backwards compatible:
- If project has no `studioSettings`, uses sensible defaults
- Old projects without studio customization will export normally
- No database migrations needed
- No API contract changes

## Files Changed

- `backend/routes/upload.js` - Enhanced export with full studio settings support
  - Lines 397-398: Added logging for verification
  - Lines 447-455: Extract all studio settings
  - Lines 512-540: Enhanced drawtext filter
  - Lines 597-598: Dynamic margins and background color in ASS style
  - Lines 606-612: Log applied settings for debugging

## Next Steps

1. Restart backend server to apply changes
2. Run test scenario above
3. Check console logs for applied settings
4. Verify exported video appearance matches Studio Tools preview
5. Test with different customization combinations

## Troubleshooting

**Issue: Studio settings not being applied**
- Check: Is `studioSettings` present in "Export initiated" log?
- Check: Are settings being saved in Studio Tools?
- Check: Is the project reloaded after save?

**Issue: Font not applying correctly**
- Check: Is TTF font in `backend/fonts/` directory?
- Check: Is font name recognized by system font config?
- Fallback: If not found, defaults to Arial

**Issue: Position not changing**
- Check: Are marginL/marginR values correct in ASS log?
- Check: Is yAxis value being used for marginV?
- Note: Very large offsets may push text off-screen

**Issue: Background not showing/hiding**
- Check: Is `showBackground` correct in logs?
- Check: Is `backColor` showing correct hex value?
- Note: ASS format may require re-export to update

