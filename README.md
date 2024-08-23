# AI Filter

## What is this?
I just quickly threw together an extension to deal with annoying posts on twitter / reddit / youtube (videos) that are  
difficult to filter with keywords. This uses gpt-4o-mini (because super cheap) to assign a score from 1 - 10 to each post, depending on  
how likely it is to be something you don't want to see. You also can assign a threshold above which posts will be hidden.

## Installation Guide
1. Download this repo as a ZIP / clone it.
2. Unzip and put it somewhere, where it will stay (don't delete it).
3. Go to the extensions page in Chrome and enable Developer options.
4. Either drag and drop it, or click "Load Unpacked" and select this folder.
5. Open the extension popup, go to settings, and input your API key and prompt.

## Notes
- Prompt is everything here, so if the filtering sucks make sure you really nail your prompt.
- This extension does not use images at all (expensive), which sucks because many posts nowadays are just an image.

# Security Notice
Your API key will be visible in the browser, including places like the Network tab of the developer console during API requests or within JavaScript variables at runtime. I never have access to your API key, but if you have concerns about its visibility, please refrain from using this extension. If you have suggestions for improving this, kindly submit a pull request with your proposed changes.