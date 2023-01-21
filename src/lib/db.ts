import Dexie from 'dexie';

// export const db = new Dexie('myAssetBuddy');
// db.version(1).stores({
//   docs: '_id, name, doctype, lastFetchedOn,modified,count', // Primary key and indexed props
// });

export const DexieDatabase = (databaseName: string = 'frappe-react-indexdb', version: number = 1) => {
    const db = new Dexie(databaseName);
    db.version(version).stores({
        docs: '_id, name, doctype, lastFetchedOn,modified,count', // Primary key and indexed props
    });
    return db;
}