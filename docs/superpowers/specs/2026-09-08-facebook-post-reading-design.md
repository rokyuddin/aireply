# Facebook Post Reading and Comment Generation Design

## Goal

Improve Facebook post extraction and AI prompting so AI correctly handles all three post formats:

- Caption with image
- Caption only
- Image only

The AI must read visible text inside images when present. The caption is the primary source of meaning; the image and OCR text provide supporting context.

## Scope

This change is limited to the existing Facebook content-script, extraction, and AI-client pipeline. It does not introduce a second analysis API call or a new provider-specific architecture.

## Behavior

### Post formats

1. **Caption plus image**
   - Extract the post caption from Facebook's story-message container.
   - Resolve the largest relevant Facebook CDN image while excluding avatars and small UI images.
   - Send both to the vision-capable model.
   - Treat the caption as the authoritative statement and the image as supporting context.

2. **Caption only**
   - Extract and send only the caption.
   - Do not include unrelated Facebook metadata, button labels, or composer text.

3. **Image only**
   - Send an empty-caption marker plus the image.
   - Ask the model to inspect the scene, people, event, mood, and visible text in the image.
   - Generate a comment only from information confidently supported by the image.

### Priority rules

The system prompt must explicitly instruct the model to:

1. Use the caption as the primary meaning and intent.
2. Use image scene and OCR text as supporting context.
3. If image content conflicts with the caption, follow the caption and avoid asserting conflicting image details.
4. Preserve the language of the caption when one exists; for image-only posts, use the language configured by the existing behavior or the model's best available context.
5. Output only one short, natural, post-specific comment.

## Extraction design

Update Facebook extraction to recognize the stable semantic attributes present in the supplied HTML:

- `data-ad-rendering-role="story_message"`
- `data-ad-preview="message"`
- `data-ad-rendering-role="description"`

The parser should prefer the story-message or message-preview text container and normalize descendant text nodes into readable paragraphs. It must exclude:

- `role="button"` content such as See more and See less
- Composer textboxes
- Image alt text used only as accessibility metadata
- Link preview metadata such as domain, title, and description
- Facebook UI labels and engagement controls

If no caption container is found, return an empty caption when a valid post image exists. Return no target only when neither caption nor image can be identified.

The existing click-time image URL resolution remains in place so signed Facebook CDN URLs are not cached.

## Data flow

1. The content script activates the selected Facebook composer.
2. The extractor expands a truncated post when possible.
3. The Facebook adapter extracts the caption from semantic story-message markup.
4. The extractor resolves the main image URL, if present.
5. The background image pipeline downloads and downscales the image to the existing provider-safe data URL format.
6. The AI client sends caption and optional image in one request.
7. The generated comment replaces only the previous AI draft in the composer.

## AI prompt design

Extend the existing prompt with explicit input handling:

- Identify whether the input is caption-only, image-only, or caption-plus-image.
- Analyze visible image text/OCR when an image is attached.
- Use caption meaning, language, and tone first.
- Use image details only when they support or enrich the caption.
- Never mention OCR, image analysis, or the AI in the final comment.

No separate analysis response is exposed to the user; analysis remains internal and the provider returns only the final comment.

## Error handling

- Missing API keys continue to open extension options.
- A post with only an image remains valid and is sent to vision.
- A post with neither usable caption nor image produces the existing extraction error.
- Image download/provider failures continue to use the existing error state and do not silently generate an unrelated text-only comment.

## Tests

Add or update tests for:

- Supplied Facebook story-message HTML extracts only the caption.
- Caption extraction excludes See less, link-preview metadata, and image alt text.
- Caption-only post creates a text-only AI input.
- Caption-plus-image post creates text and image input parts.
- Image-only post creates an image input with an empty-caption marker.
- Prompt instructs caption priority and visible image-text/OCR reading.
- Conflicting caption and image context follows the caption priority rule.
- Existing avatar exclusion and largest-image selection remain intact.

## Acceptance criteria

- The supplied HTML produces the Bengali caption without `Mobile uploads` or other preview metadata.
- Caption-plus-image posts generate comments based primarily on the caption while using the image as context.
- Caption-only posts work without an image part.
- Image-only posts are sent to the vision model and can produce a relevant comment.
- Text visible inside an image is considered by the model.
- Existing draft replacement, missing-key handling, and image downscaling behavior remain unchanged.
