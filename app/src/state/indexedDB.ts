import { openDB, IDBPDatabase, DBSchema } from 'idb';

const DB_NAME = 'free_sleep';
const STORE_NAME = 'user_store';
const DB_VERSION = 3;
const KEY_PATH = 'user_key';
const USER_SETTINGS = 'user-settings';

// Define the structure of the data stored in IndexedDB
export type UserSettings = {
  user_key: string; // This is the primary key as per IndexedDB schema
  side?: 'left' | 'right';
  temperature?: number;
  alarm?: {
    time: string;
    days: string[];
  };
  preferences?: {
    cooling_level: 'low' | 'medium' | 'high';
    sleep_mode: boolean;
  };
};


// Define the database schema according to the idb documentation
interface FreeSleepDB extends DBSchema {
  user_store: {
    key: string; // The primary key of the object store
    value: UserSettings; // The type of data stored in the object store
  };
}


// Singleton instance of IndexedDB with proper typing
let dbInstance: IDBPDatabase<FreeSleepDB> | null = null;

// Function to initialize and return the IndexedDB instance once
const initDB = async (): Promise<IDBPDatabase<FreeSleepDB>> => {
  if (!dbInstance) {
    dbInstance = await openDB<FreeSleepDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'user_key' });
        }
      },
    });
  }
  return dbInstance;
};

// Function to store JSON data (update entire object)
export const setDataInIndexedDB = async (data: UserSettings): Promise<void> => {
  try {
    const db = await initDB();
    if (!data[KEY_PATH as keyof UserSettings]) {
      throw new Error(`Missing required key '${KEY_PATH}' in the object.`);
    }
    await db.put(STORE_NAME, data);
  } catch (error) {
    console.error('Error saving data to IndexedDB:', error);
  }
};

// Function to get entire JSON object
export const getAllDataFromIndexedDB = async (): Promise<UserSettings | null> => {
  try {
    const db = await initDB();
    const result = await db.get(STORE_NAME, USER_SETTINGS);
    return result || null; // Return null if not found
  } catch (error) {
    console.error('Error retrieving data from IndexedDB:', error);
    return null;
  }
};

// Function to get a specific field dynamically
export const getFieldFromIndexedDB = async <T extends keyof UserSettings>(
  field: T
): Promise<UserSettings[T] | null> => {
  try {
    const data = await getAllDataFromIndexedDB();
    if (data?.hasOwnProperty(field)) {
      return data[field];
    } else {
      return null;
    }
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error(`Error retrieving field '${field}' from IndexedDB:`, error);
    return null;
  }
};

// Function to update a specific field dynamically
export const updateFieldInIndexedDB = async <T extends keyof UserSettings>(
  field: T,
  value: UserSettings[T]
): Promise<void> => {
  try {
    const existingData = await getAllDataFromIndexedDB();
    const updatedData = { ...existingData, [field]: value, [KEY_PATH]: USER_SETTINGS };
    await setDataInIndexedDB(updatedData as UserSettings);
  } catch (error) {
    console.error(`Error updating field '${field}' in IndexedDB:`, error);
  }
};

// Function to clear the entire store
export const clearIndexedDB = async (): Promise<void> => {
  try {
    const db = await initDB();
    await db.clear(STORE_NAME);
  } catch (error) {
    console.error('Error clearing IndexedDB:', error);
  }
};
