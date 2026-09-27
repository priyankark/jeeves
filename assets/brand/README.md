# Jeeves icon

The current icon is an abstract ink-black J and angular ivory collar on burnt orange, inspired by the flat silhouettes and colour fields of the [Jeeves Omnibus covers](https://www.wodehouse.co.uk/books/the-jeeves-omnibus-vol-4/). It is an original composition generated with the built-in image tool. The earlier portrait is archived as `jeeves-portrait-v1.png`.

The selected master is `jeeves-master.png`. `npm run build:icons` regenerates `electron/icons/jeeves.icns`, `.ico`, `.png`, and the small web icons in `public/` using macOS sips/iconutil. Prebuilt formats are included for other platforms. Windows and Linux display have not been tested.

## Generation prompt

Use case: logo-brand. Create one finished app icon for Jeeves.
The attached Wodehouse omnibus book cover is a visual-language reference only: reductive angular silhouettes, large confident flat colour fields, literary wit, spare mid-century British book-jacket design. Make an original composition, not a reproduction of the cover, no cover text.
Design an ABSTRACT emblem, not an illustrated person: a large off-centre ink-black shape with one elegant stepped angular edge that only subtly suggests a valet's side profile, integrated into a sharp ivory shirt-collar slash and a tiny geometric bow-tie cutout. Aim for a clever silhouette assembled from just 3 or 4 large flat shapes; the viewer first sees a strong graphic mark, only later the suggestion of Jeeves. A subtle J-like sweep in the lower silhouette is welcome if naturally integrated. No complete human head, no face details, no eyes, no ears, no smile, no nose illustration, no hat, no cartoon, no mascot.
Warm burnt-orange/vermilion rounded-square field, near-black ink and warm paper-ivory shapes. Use the cover's confident graphic restraint. Completely flat solid screenprint-style colour, precise crisp edges, no gradients, no shading, no texture, no 3D, no shine, no embossing, no shadow. Smart, dry, editorial, understated. Bold enough to read at 24 pixels. Large deliberate negative space, approximately 15% breathing room.
Square canvas, one centered rounded-square application tile with genuinely transparent pixels outside its corners. No text, no letters printed separately, no words, no logo sheet, no mockup.

## Refinement

Edit this icon. Keep the exact black abstract J/valet silhouette, ivory collar slash, bow tie, composition and orange palette. Repair the background: the entire rounded-square tile must be completely solid opaque burnt orange, including ALL space to the left of the J. Remove the large transparent/black void and dark halo on the left. Remove all shadows, glow, gradients, noise, speckles and stray pixels. Use exactly three solid flat colours: orange #E76632, ink #202126, ivory #F7EED8. Clean precise vector-like edges. The ONLY transparent region is outside the rounded square tile; every single pixel inside the tile is opaque. No other changes.

A final background-extraction pass removed the generated checkerboard outside the tile and replaced it with actual alpha transparency, preserving the interior artwork.
