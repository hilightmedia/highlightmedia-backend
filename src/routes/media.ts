import { FastifyInstance } from "fastify";
import {
  bulkDeleteFile,
  bulkFolderDelete,
  createFolder,
  deleteFile,
  deleteFolder,
  editFileName,
  editFolder,
  getClientFolders,
  getClients,
  getFolderFiles,
  getMedia,
  uploadMedia,
} from "../controllers/media";
import { authGuard } from "../services/authGuard";

export default async function mediaRoutes(app: FastifyInstance) {
  app.get("/folders", { preHandler: [authGuard] }, getClientFolders);

  app.post(
    "/folders/create",
    {
      schema: {
        body: {
          type: "object",
          required: ["name"],
          properties: {
            name: { type: "string", minLength: 3, maxLength: 50 },
            start_date: { type: "string", format: "date" },
            end_date: { type: "string", format: "date" },
          },
        },
      },
      preHandler: [authGuard],
    },
    createFolder,
  );

app.post(
  "/:folderId/upload-media",
  {
    schema: {
      params: {
        type: "object",
        required: ["folderId"],
        properties: {
          folderId: { type: "number" },
        },
      },
      consumes: ["multipart/form-data"],
    },
    preHandler: [authGuard],
  },
  uploadMedia,
);


  app.get(
    "/:folderId/media",
    {
      schema: {
        params: {
          type: "object",
          required: ["folderId"],
          properties: {
            folderId: { type: "number" },
          },
        },
      },
      preHandler: [authGuard],
    },
    getMedia,
  );

  app.post(
    "/edit-folder",
    {
      schema: {
        body: {
          type: "object",
          required: ["folderId", "name"],
          properties: {
            folderId: { type: "number" },
            name: { type: "string", minLength: 3, maxLength: 50 },
            start_date: { type: "string", format: "date" },
            end_date: { type: "string", format: "date" },
          },
        },
      },
    },
    editFolder,
  );

  app.post(
    "/delete-folder",
    {
      schema: {
        body: {
          type: "object",
          required: ["folderId"],
          properties: {
            folderId: { type: "number" },
          },
        },
      },
      preHandler: [authGuard],
    },
    deleteFolder,
  );

  app.post(
    "/delete-file",
    {
      schema: {
        body: {
          type: "object",
          required: ["fileId"],
          properties: {
            fileId: { type: "string" },
          },
        },
      },
      preHandler: [authGuard],
    },
    deleteFile,
  );

  app.post(
    "/edit-file-name",
    {
      schema: {
        body: {
          type: "object",
          required: ["fileId", "name"],
          properties: {
            fileId: { type: "string" },
            name: { type: "string", minLength: 3, maxLength: 50 },
          },
        },
      },
      preHandler: [authGuard],
    },
    editFileName,
  );
  app.post(
    "/bulk/delete-file",
    {
      schema: {
        body: {
          type: "object",
          required: ["fileIds"],
          properties: {
            fileIds: { type: "array", items: { type: "number" }, minItems: 1 },
          },
        },
      },
      preHandler: [authGuard],
    },
    bulkDeleteFile,
  );

  app.post(
    "/bulk/delete-folder",
    {
      schema: {
        body: {
          type: "object",
          required: ["folderIds"],
          properties: {
            folderIds: {
              type: "array",
              items: { type: "number" },
              minItems: 1,
            },
          },
        },
      },
      preHandler: [authGuard],
    },
    bulkFolderDelete,
  );

  app.get("/get-folders", { preHandler: [authGuard] }, getClients);
  app.get(
    "/:folderId/get-files",
    {
      preHandler: [authGuard],
      schema: {
        params: {
          type: "object",
          required: ["folderId"],
          properties: { folderId: { type: "number" } },
        },
      },
    },
    getFolderFiles,
  );
}
