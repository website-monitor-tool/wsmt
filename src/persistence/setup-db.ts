import type { Database } from 'better-sqlite3';

export const setup = (db: Database) => {
    db.exec(`
        CREATE TABLE IF NOT EXISTS services (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE NOT NULL,
        initial_connection_ms INTEGER NOT NULL,
        clean_close INTEGER NOT NULL DEFAULT 0
        );

        CREATE TABLE IF NOT EXISTS service_metrics (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        service_id INTEGER NOT NULL,
        last_connected_ms INTEGER NOT NULL,
        type TEXT,
        description TEXT,
        FOREIGN KEY (service_id) REFERENCES services(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS downtimes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        service_id INTEGER NOT NULL,
        down_from DATETIME NOT NULL,
        down_to DATETIME,
        reason TEXT,
        FOREIGN KEY (service_id) REFERENCES services(id) ON DELETE CASCADE
        );
`);
}
