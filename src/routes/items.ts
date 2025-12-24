import { Router } from "express";
import { z } from "zod";
import { pool } from "../db";

const router = Router();

const CreateItemSchema = z.object({
  name: z.string().min(1),
  category: z.string().min(1),
  status: z.enum(["active", "repair", "retired"]).optional().default("active"),
});

const UpdateItemSchema = z.object({
  name: z.string().min(1).optional(),
  category: z.string().min(1).optional(),
  status: z.enum(["active", "repair", "retired"]).optional(),
});

// GET /api/items?search=term
router.get("/", async (req, res) => {
  const search = (req.query.search as string | undefined)?.trim();

  if (search) {
    const result = await pool.query(
      `SELECT * FROM items
       WHERE name ILIKE '%' || $1 || '%'
          OR category ILIKE '%' || $1 || '%'
       ORDER BY id DESC`,
      [search]
    );
    return res.json(result.rows);
  }

  const result = await pool.query("SELECT * FROM items ORDER BY id DESC");
  res.json(result.rows);
});

// GET /api/items/:id
router.get("/:id", async (req, res) => {
  const id = Number(req.params.id);
  const result = await pool.query("SELECT * FROM items WHERE id=$1", [id]);

  if (result.rowCount === 0) return res.status(404).json({ message: "Not found" });
  res.json(result.rows[0]);
});

// POST /api/items
router.post("/", async (req, res) => {
  const parsed = CreateItemSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: "Invalid input", errors: parsed.error.flatten() });
  }

  const { name, category, status } = parsed.data;

  const result = await pool.query(
    `INSERT INTO items (name, category, status)
     VALUES ($1, $2, $3)
     RETURNING *`,
    [name, category, status]
  );

  res.status(201).json(result.rows[0]);
});

// PUT /api/items/:id
router.put("/:id", async (req, res) => {
  const id = Number(req.params.id);

  const parsed = UpdateItemSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: "Invalid input", errors: parsed.error.flatten() });
  }

  // get current record
  const current = await pool.query("SELECT * FROM items WHERE id=$1", [id]);
  if (current.rowCount === 0) return res.status(404).json({ message: "Not found" });

  const merged = { ...current.rows[0], ...parsed.data };

  const result = await pool.query(
    `UPDATE items
     SET name=$1, category=$2, status=$3
     WHERE id=$4
     RETURNING *`,
    [merged.name, merged.category, merged.status, id]
  );

  res.json(result.rows[0]);
});

// DELETE /api/items/:id
router.delete("/:id", async (req, res) => {
  const id = Number(req.params.id);
  const result = await pool.query("DELETE FROM items WHERE id=$1 RETURNING *", [id]);

  if (result.rowCount === 0) return res.status(404).json({ message: "Not found" });
  res.json({ message: "Deleted", item: result.rows[0] });
});

export default router;
