import express from "express";
import { asyncHandler } from "../../core/utils/asyncHandler.js";
import { logger } from "../../core/utils/logger.js";
import https from "https";
import http from "http";

const router = express.Router();

/**
 * @route   GET /api-v1/image-proxy
 * @desc    Proxy external images to avoid CORS issues
 * @access  Public
 */
router.get(
  "/image-proxy",
  asyncHandler(async (req, res) => {
    const { url } = req.query;

    if (!url) {
      return res.status(400).json({ error: "URL parameter is required" });
    }

    try {
      // Validate URL
      const imageUrl = new URL(url);

      // Security: only allow specific domains
      const allowedDomains = [
        "api.asicredinvest.md",
        // Add other trusted domains here
      ];

      if (!allowedDomains.includes(imageUrl.hostname)) {
        return res.status(403).json({ error: "Domain not allowed" });
      }

      // Fetch the image using Node.js built-in modules
      const client = imageUrl.protocol === "https:" ? https : http;

      const imageRequest = client.get(url, (imageResponse) => {
        if (imageResponse.statusCode !== 200) {
          return res
            .status(imageResponse.statusCode)
            .json({ error: "Failed to fetch image" });
        }

        // Set CORS headers
        res.set({
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET",
          "Access-Control-Allow-Headers": "Content-Type",
          "Content-Type": imageResponse.headers["content-type"] || "image/jpeg",
          "Cache-Control": "public, max-age=86400", // Cache for 24 hours
        });

        // Stream the image
        imageResponse.pipe(res);
      });

      imageRequest.on("error", (error) => {
        logger.error("Image proxy request error:", {
          url,
          error: error.message,
        });
        res.status(500).json({ error: "Failed to fetch image" });
      });
    } catch (error) {
      logger.error("Image proxy error:", { url, error: error.message });
      res.status(500).json({ error: "Internal server error" });
    }
  })
);

export default router;
