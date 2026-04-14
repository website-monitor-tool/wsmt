import Database from "better-sqlite3";
import { setup } from "./setup-db.js"

let running = false;

const connectToDB = (path?: string) => {
    const db = new Database(path || "./wsmt.db");
    db.pragma("journal_mode = WAL");

    setup(db);

    running = true;
    return db;
}

const db = connectToDB();

// export const getAllSavedServices = () => {
//     const stmt = db.prepare(`
//         Select name from services
//     `);

//     return stmt.all().map(row => row.name);
// }

// export const updateDowntime = (
//   service_id: number,
//   down_from: number,
//   down_to: number | null = null
// ) => {
//   const stmt = db.prepare(`
//     INSERT INTO downtimes (service_id, down_from, down_to)
//     VALUES (?, ?, ?)
//   `);

//   stmt.run(
//     service_id,
//     down_from,
//     down_to ? down_to : null
//   );
// };

export const registerDowntime = (
  service_id: number,
  down_from: number
) => {
  const openDowntime = db.prepare(`
    SELECT id FROM downtimes
    WHERE service_id = ?
    AND down_to IS NULL
    LIMIT 1
  `).get(service_id) as { id: number } | undefined;

  if (openDowntime) {
    //log(`Downtime for service ${service_id} already open, skipping.`);
    return;
  }

  const insertStmt = db.prepare(`
    INSERT INTO downtimes (service_id, down_from, down_to)
    VALUES (?, ?, NULL)
  `);
  insertStmt.run(service_id, down_from);
};

export const closeDowntime = (
  service_id: number,
  down_to: number
) => {
  const openDowntime = db.prepare(`
    SELECT id FROM downtimes
    WHERE service_id = ?
    AND down_to IS NULL
    ORDER BY down_from DESC
    LIMIT 1
  `).get(service_id) as { id: number } | undefined;

  if (!openDowntime) {
    throw new Error(`No open downtime found for service ${service_id} to close.`);
  }

  const updateStmt = db.prepare(`
    UPDATE downtimes
    SET down_to = ?
    WHERE id = ?
  `);
  updateStmt.run(down_to, openDowntime.id);
};

export const setCleanClose = (service_id: number) => {
  db.prepare(`
    UPDATE services SET clean_close = 1 WHERE id = ?
  `).run(service_id);
};

export const resetCleanClose = (service_id: number) => {
  db.prepare(`
    UPDATE services SET clean_close = 0 WHERE id = ?
  `).run(service_id);
};

export const getServiceDailyStatus = () => {
  const stmt = db.prepare(`
    SELECT 
      service_id,
      DATE(datetime(down_from / 1000, 'unixepoch')) as day,

      SUM(
        CASE 
          WHEN down_to IS NOT NULL THEN down_to - down_from
          ELSE (strftime('%s','now') * 1000) - down_from
        END
      ) as total_downtime_ms,

      CASE
        -- 🔴 If currently down → always offline
        WHEN MAX(CASE WHEN down_to IS NULL THEN 1 ELSE 0 END) = 1 THEN 'offline'

        -- 🟢 No downtime at all
        WHEN SUM(
          CASE 
            WHEN down_to IS NOT NULL THEN down_to - down_from
            ELSE (strftime('%s','now') * 1000) - down_from
          END
        ) = 0 THEN 'online'

        -- 🔴 Fully down all day
        WHEN SUM(
          CASE 
            WHEN down_to IS NOT NULL THEN down_to - down_from
            ELSE (strftime('%s','now') * 1000) - down_from
          END
        ) >= 86400000 THEN 'offline'

        -- 🟡 Partial issues
        ELSE 'degraded'
      END as status

    FROM downtimes
    GROUP BY day, service_id
    ORDER BY day DESC, service_id ASC
  `);

  return stmt.all();
};


export const saveStatus = (name: string, initial_connection_ms: number) => {
    const stmt = db.prepare(`
        INSERT INTO services (name, initial_connection_ms)
        VALUES (?, ?)
    `);

    try {
        stmt.run(name, initial_connection_ms);
    } catch (err) {
        console.error(err);
    }
}

export const loadAllStatuses = () => {
  return db.prepare(`
    SELECT 
      s.*,
      d.down_from as last_downtime_ms
    FROM services s
    LEFT JOIN downtimes d 
      ON d.service_id = s.id 
      AND d.down_to IS NULL
    ORDER BY s.id
  `).all();
}

export const getOpenDowntime = (service_id: number): { down_from: number } | undefined => {
  return db.prepare(`
    SELECT down_from FROM downtimes
    WHERE service_id = ?
    AND down_to IS NULL
    ORDER BY down_from DESC
    LIMIT 1
  `).get(service_id) as { down_from: number } | undefined;
}

