---
"@chai-ui/core": patch
"@chai-ui/react": patch
"@chai-ui/vue": patch
"@chai-ui/tokens": patch
---

Composer: Create image keeps its Aspect ratio menu when an image is attached. The suggested edit models it switches to (Flux 3 Image, Nano Banana Pro, GPT Image 2) now list the aspect ratios Fal takes for them; the Edit image use case still keeps the image's shape and sends none. Veo 3.1 Fast's image-to-video lists its 16:9 and 9:16 crops; the other image-to-video models follow the image's shape, so Video with an attached image shows the menu only with Veo picked.
