import { createRouteHandler } from "uploadthing/next";

import { ourFileRouter } from "@/lib/uploadthing/core";

// GET/POST for the UploadThing client. Requires UPLOADTHING_TOKEN at request time;
// without it, uploads fail gracefully (the file-upload UI is gated on that env).
export const { GET, POST } = createRouteHandler({ router: ourFileRouter });
