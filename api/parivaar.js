import { handleParivaarApiRequest } from "../server/parivaarApiHandler.mjs";

export default async function handler(req, res) {
  return handleParivaarApiRequest(req, res);
}
