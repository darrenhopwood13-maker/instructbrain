# InstructBrain 30-second promo reel and website sharing

Create a high-impact, portrait motion-graphics reel that presents InstructBrain’s major feature families in 30 seconds, then make it publicly viewable and shareable from the app in the same way as instructSite.

## Creative direction

- **Format:** 1080 × 1920 portrait, exactly 30 seconds, designed for reels and phone sharing.
- **Style:** precise, premium construction-tech motion graphics rather than generated footage or a screen recording.
- **Brand:** Royal Navy `#24417B`, Deep Navy `#182E5B`, Laser Green `#57FF00`, white and soft-white only; white “instruct” with Laser Green “Brain”. Audiowide wordmark, Sora display type and Manrope supporting text.
- **Visual language:** the faint 48px blueprint grid, dimensional green controls, technical drawing lines, photo stacks, report sheets and crisp status markers. No mascots, floating orbs, decorative blobs or generic neon-tech effects.
- **Motion system:** fast masked reveals and controlled depth moves; interface elements snap into place; blueprint wipes connect scenes; the final document resolves calmly into the brand card. All animation is frame-based and deterministic.
- **Sound:** confident modern corporate instrumental with a restrained rhythmic build and a clean final resolve. No voiceover. Every message remains understandable with sound off.

## 30-second story

| Time | Beat | What the viewer sees | Core message |
|---|---|---|---|
| 0–3s | Hook | Site photographs land over the blueprint grid and resolve into a finished report cover. | **Photos in. Client-ready reports out.** |
| 3–8s | Capture | Phone capture, gallery upload, ordered photographs, room allocation and retained date/location evidence. | **Capture once. Keep the evidence.** |
| 8–13s | Intelligent drafting | A scan passes over full-resolution photos; structured findings, confidence and `Not assessed` appear; a human confirmation lands last. | **AI drafts. You decide.** |
| 13–19s | Every report workflow | A rapid, legible carousel shows Custom Reports, site walks and snagging, Property Inventory, and Manual Photographic Reports with arrows, shapes and notes. | **One engine. Every site report.** |
| 19–24s | Compliance and close-out | The six weekly compliance checks complete; one action is raised, assigned and closed; trade extracts fan out. | **Track actions through to close-out.** |
| 24–27s | Issue and distribute | Branded PDF pages, contents, multilingual issue, PDF link, email attachment and device sharing appear as one deliberate issue flow. | **Review. Issue. Share.** |
| 27–30s | Brand close | Finished report beside the instructBrain wordmark and “An instructSite Company”. | **Walk the site. Issue the same afternoon.** |

The reel will cover the product’s major capabilities without making unsupported performance, automation or safety claims. It will show that uncertain AI output requires human review and that distribution is always initiated by the user.

## Video production

- Build the reel as a standalone Remotion project with separate scene files and shared brand/motion primitives.
- Use the existing approved demo site photographs and purpose-built interface/report compositions; do not expose customer reports or personal data.
- Create the instrumental soundtrack locally, mix it below the visual story, and fade it cleanly at both ends.
- Render key stills first, inspect hierarchy and legibility, then render the final H.264 MP4.
- Check the first and last frames, every scene transition, mute readability, audio playback, exact duration, dimensions and file size.
- Deliver a master copy as `/mnt/documents/instructBrain-30-second-promo.mp4` and add the website copy through the project’s managed asset flow.

## Website integration

- Add a public `/promo` page with its own title, description, Open Graph metadata and a branded portrait video player. It will work without signing in and include a clear route back to InstructBrain.
- Add **Share Promo Video** to the existing account/settings menu, matching instructSite’s proven behaviour:
  - open the phone’s native share sheet when available;
  - otherwise copy the absolute `/promo` link and show a confirmation;
  - cancellation sends nothing and shows no false success message.
- Keep the app’s reporting, permissions, data and distribution workflows unchanged.

## Verification

- Run the existing test suite before and after the app changes, plus the TypeScript check.
- Confirm the public page plays on phone and desktop, fits without horizontal overflow, and remains usable with keyboard and screen reader controls.
- Confirm the share action uses the correct production-domain URL and that clipboard fallback works.
- Confirm the final app build succeeds and the rendered MP4 has video and audio streams at 1080 × 1920 for exactly 30 seconds.
