import { generateReactHelpers } from "@uploadthing/react";

import type { OurFileRouter } from "@/lib/uploadthing/core";

// `import type` above is erased at build, so this client module never pulls the
// server file router (and its auth imports) into the browser bundle.
export const { useUploadThing, uploadFiles } =
  generateReactHelpers<OurFileRouter>();
