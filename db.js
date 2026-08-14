function currentUid() {
  const user = window.FB.auth.currentUser;
  if (!user) throw new Error('Not signed in');
  return user.uid;
}
function docKeyFor(storeName, record) {
  return storeName === 'meta' ? record.key : record.id;
}
function collRef(storeName) {
  return window.FB.collection(window.FB.firestore, 'users', currentUid(), storeName);
}
function docRef(storeName, key) {
  return window.FB.doc(window.FB.firestore, 'users', currentUid(), storeName, String(key));
}

const DB = {
  uid() {
    if (crypto.randomUUID) return crypto.randomUUID();
    return 'id-' + Date.now() + '-' + Math.random().toString(16).slice(2);
  },
  async getAll(storeName) {
    const snap = await window.FB.getDocs(collRef(storeName));
    return snap.docs.map((d) => d.data());
  },
  async getAllFromCache(storeName) {
    try {
      const snap = await window.FB.getDocsFromCache(collRef(storeName));
      return snap.docs.map((d) => d.data());
    } catch (e) {
      return null; // this query has never been cached yet (e.g. first-ever sign in)
    }
  },
  async getAllFromServer(storeName) {
    const snap = await window.FB.getDocsFromServer(collRef(storeName));
    return snap.docs.map((d) => d.data());
  },
  async get(storeName, id) {
    const snap = await window.FB.getDoc(docRef(storeName, id));
    return snap.exists() ? snap.data() : undefined;
  },
  async put(storeName, record) {
    await window.FB.setDoc(docRef(storeName, docKeyFor(storeName, record)), record);
    return record;
  },
  async delete(storeName, id) {
    await window.FB.deleteDoc(docRef(storeName, id));
  },
  async clearAll() {
    const names = ['products', 'sales', 'expenses', 'meta', 'customers'];
    for (const name of names) {
      const records = await DB.getAll(name);
      const refs = records.map((rec) => docRef(name, docKeyFor(name, rec)));
      await runBatched(refs, (batch, ref) => batch.delete(ref));
    }
  },
  async exportAll() {
    const [products, sales, expenses, meta, customers] = await Promise.all([
      DB.getAll('products'), DB.getAll('sales'), DB.getAll('expenses'), DB.getAll('meta'), DB.getAll('customers')
    ]);
    return { version: 2, exportedAt: new Date().toISOString(), products, sales, expenses, meta, customers };
  },
  async importAll(data) {
    const stores = { products: data.products, sales: data.sales, expenses: data.expenses, meta: data.meta, customers: data.customers };
    for (const [name, records] of Object.entries(stores)) {
      if (!Array.isArray(records)) continue;
      const items = records.map((rec) => ({ ref: docRef(name, docKeyFor(name, rec)), rec }));
      await runBatched(items, (batch, item) => batch.set(item.ref, item.rec));
    }
  }
};

async function runBatched(items, applyOp) {
  const CHUNK_SIZE = 400;
  for (let i = 0; i < items.length; i += CHUNK_SIZE) {
    const chunk = items.slice(i, i + CHUNK_SIZE);
    const batch = window.FB.writeBatch(window.FB.firestore);
    chunk.forEach((item) => applyOp(batch, item));
    await batch.commit();
  }
}
