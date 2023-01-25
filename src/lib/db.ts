import Dexie from 'dexie';

export interface Doc {
    _id: string;
    name: string;
    doctype: string;
    lastFetchedOn: Date;
    modified: string;
    count: number;
}

export class DexieDatabase extends Dexie {
    docs!: Dexie.Table<Doc, string>;

    constructor(databaseName: string = 'frappe-react-indexdb', version: number = 1) {
        super(databaseName);
        this.version(version).stores({
            docs: '_id, name, doctype, lastFetchedOn,modified,count', // Primary key and indexed props
        });
    }
}

export const indexdb = new DexieDatabase();
