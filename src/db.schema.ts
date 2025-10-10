import { relations } from 'drizzle-orm';
import {
  pgTable,
  varchar,
  text,
  timestamp,
  unique,
  boolean,
  numeric,
} from 'drizzle-orm/pg-core';

const datedColumns = {
  createdAt: timestamp().defaultNow().notNull(),
  updatedAt: timestamp()
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
};

export const Firmwares = pgTable(
  'firmwares',
  {
    id: varchar({ length: 42 }).primaryKey(),
    release_id: varchar({ length: 64 }).notNull(),
    status: text({
      enum: [
        'QUEUED',
        'CREATING_BUILD_FOLDER',
        'DOWNLOADING_SOURCE',
        'EXTRACTING_SOURCE',
        'BUILDING',
        'SAVING',
        'DONE',
        'ERROR',
      ],
    }).notNull(),
    ...datedColumns,
  },
  (t) => [unique().on(t.id)],
);

export const FirmwareFiles = pgTable('firmwareFiles', {
  filePath: varchar({ length: 255 }).notNull(),
  offset: numeric({ mode: 'number' }).notNull(),
  isFirmware: boolean().notNull(),
  firmwareId: varchar({ length: 42 })
    .references(() => Firmwares.id, {
      onDelete: 'cascade',
    })
    .notNull(),
});

export const FirmwareRelations = relations(Firmwares, ({ many }) => ({
  files: many(FirmwareFiles),
}));

export const FirmwareFilesRelations = relations(FirmwareFiles, ({ one }) => ({
  firmware: one(Firmwares, {
    fields: [FirmwareFiles.firmwareId],
    references: [Firmwares.id],
  }),
}));
