import swaggerJsdoc from "swagger-jsdoc";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "Taiginsky API",
      version: "2.0.0",
      description: "REST API for Taiginsky residential community platform",
      contact: {
        name: "Taiginsky Development Team",
        email: "support",
      },
      license: {
        name: "ISC",
      },
    },
    servers: [
      {
        url: "http://localhost:4000",
        description: "Development server",
      },
      {
        url: "https://api.taiginsky.md",
        description: "Production server",
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
          description: "Enter JWT token",
        },
      },
      schemas: {
        Error: {
          type: "object",
          properties: {
            error: {
              type: "object",
              properties: {
                message: {
                  type: "string",
                  example: "Error message",
                },
                code: {
                  type: "string",
                  example: "ERROR_CODE",
                },
                statusCode: {
                  type: "number",
                  example: 400,
                },
                timestamp: {
                  type: "string",
                  format: "date-time",
                },
                details: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      field: { type: "string" },
                      message: { type: "string" },
                    },
                  },
                },
              },
            },
          },
        },
        User: {
          type: "object",
          properties: {
            user_id: { type: "number", example: 123456789 },
            username: { type: "string", example: "johndoe" },
            first_name: { type: "string", example: "John" },
            last_name: { type: "string", example: "Doe" },
            avatar: { type: "string", format: "uri", nullable: true },
            status: { type: "string", enum: ["active", "inactive", "banned"] },
            created_at: { type: "string", format: "date-time" },
            updated_at: { type: "string", format: "date-time" },
          },
        },
        Ad: {
          type: "object",
          properties: {
            id: { type: "number", example: 1 },
            user_id: { type: "number", example: 123456789 },
            title: { type: "string", example: "Продам диван" },
            content: { type: "string", example: "Диван в отличном состоянии" },
            category: { type: "string", example: "furniture" },
            subcategory: { type: "string", example: "sofa", nullable: true },
            price: { type: "string", example: "5000", nullable: true },
            status: {
              type: "string",
              enum: ["active", "archive", "draft", "deleted"],
            },
            view_count: { type: "number", example: 10 },
            images: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  id: { type: "number" },
                  image_url: { type: "string", format: "uri" },
                  is_main: { type: "boolean" },
                },
              },
            },
            created_at: { type: "string", format: "date-time" },
            updated_at: { type: "string", format: "date-time" },
          },
        },
        CreateAdRequest: {
          type: "object",
          required: ["user_id", "title", "content", "category"],
          properties: {
            user_id: { type: "number" },
            title: { type: "string", minLength: 3, maxLength: 200 },
            content: { type: "string", minLength: 10, maxLength: 5000 },
            category: { type: "string" },
            subcategory: { type: "string", nullable: true },
            price: { type: "string", nullable: true },
            status: {
              type: "string",
              enum: ["active", "draft"],
              default: "active",
            },
            images: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  url: { type: "string", format: "uri" },
                  is_main: { type: "boolean" },
                },
              },
            },
            isTelegram: { type: "boolean", default: false },
            selectedChats: { type: "array", items: { type: "object" } },
          },
        },
        UpdateAdRequest: {
          type: "object",
          properties: {
            title: { type: "string", minLength: 3, maxLength: 200 },
            content: { type: "string", minLength: 10, maxLength: 5000 },
            category: { type: "string" },
            subcategory: { type: "string", nullable: true },
            price: { type: "string", nullable: true },
            status: { type: "string", enum: ["active", "archive", "draft"] },
            images: { type: "array", items: { type: "object" } },
          },
        },
        TelegramAuthRequest: {
          type: "object",
          required: ["id", "first_name", "auth_date", "hash"],
          properties: {
            id: { type: "number" },
            username: { type: "string", nullable: true },
            first_name: { type: "string" },
            last_name: { type: "string", nullable: true },
            photo_url: { type: "string", format: "uri", nullable: true },
            auth_date: { type: "number" },
            hash: { type: "string" },
          },
        },
      },
    },
    tags: [
      { name: "Authentication", description: "Authentication endpoints" },
      { name: "Users", description: "User management endpoints" },
      { name: "Ads", description: "Advertisement endpoints" },
      { name: "Health", description: "Health check endpoints" },
    ],
  },
  apis: [
    path.join(__dirname, "../../presentation/routes/*.js"),
    path.join(__dirname, "./swagger.docs.js"),
  ],
};

export const swaggerSpec = swaggerJsdoc(options);
