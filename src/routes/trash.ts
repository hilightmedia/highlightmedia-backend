import { FastifyInstance } from "fastify";
import {
    deleteTrashItemPermanent,
    emptyTrash,
    getTrash,
    restoreAllTrash,
    restoreTrashItem,
} from "../controllers/trash";

export default async function trashRoutes(app: FastifyInstance) {
  app.get("/", getTrash);

  app.post("/restore-all", restoreAllTrash);
  app.post("/empty", emptyTrash);

  app.post<{
    Params: { kind: "folder" | "file"; id: string };
  }>("/:kind/:id/restore", restoreTrashItem);

  app.delete<{
    Params: { kind: "folder" | "file"; id: string };
  }>("/:kind/:id", deleteTrashItemPermanent);
}
