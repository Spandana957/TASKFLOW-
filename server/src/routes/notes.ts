import { Router } from 'express';
import { z } from 'zod';
import { Types } from 'mongoose';
import { Note } from '../models/index.js';
import { ah } from '../middleware/auth.js';

const r = Router();
const body = z.object({
  title: z.string().trim().max(200).optional(),
  contentHtml: z.string().max(200_000).optional(),
  color: z.enum(['default', 'yellow', 'green', 'blue', 'pink', 'purple']).optional(),
  pinned: z.boolean().optional(),
  tags: z.array(z.string().trim().min(1).max(30)).max(20).optional(),
});
const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

r.get(
  '/',
  ah(async (req, res) => {
    const search = typeof req.query.search === 'string' ? req.query.search : '';
    const filter: Record<string, unknown> = { user: req.userId };
    if (search) {
      const rx = new RegExp(escapeRegex(search), 'i');
      filter.$or = [{ title: rx }, { contentHtml: rx }, { tags: rx }];
    }
    const notes = await Note.find(filter).sort({ pinned: -1, updatedAt: -1 }).limit(500).lean();
    res.json({ notes });
  }),
);

r.post(
  '/',
  ah(async (req, res) => {
    const note = await Note.create({ ...body.parse(req.body), user: req.userId });
    res.status(201).json({ note });
  }),
);

r.patch(
  '/:id',
  ah(async (req, res) => {
    if (!Types.ObjectId.isValid(req.params.id)) return res.status(404).json({ error: 'Note not found' });
    const note = await Note.findOneAndUpdate(
      { _id: req.params.id, user: req.userId },
      { $set: body.parse(req.body) },
      { new: true },
    );
    if (!note) return res.status(404).json({ error: 'Note not found' });
    res.json({ note });
  }),
);

r.delete(
  '/:id',
  ah(async (req, res) => {
    if (!Types.ObjectId.isValid(req.params.id)) return res.status(404).json({ error: 'Note not found' });
    const note = await Note.findOneAndDelete({ _id: req.params.id, user: req.userId });
    if (!note) return res.status(404).json({ error: 'Note not found' });
    res.json({ ok: true });
  }),
);

export default r;
