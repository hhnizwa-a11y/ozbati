/**
 * نقطة الربط المستقبلية للمزامنة بين الأجهزة (Firebase Authentication + Firestore).
 *
 * النسخة الأولى تعمل محليًا فقط، ولا يوجد أي اتصال خارجي.
 * لإضافة Firebase لاحقًا:
 *   1. npm i firebase
 *   2. أنشئ FirebaseSyncAdapter يطبّق SyncAdapter أدناه:
 *      - signIn(): signInWithPopup / signInWithEmailAndPassword
 *      - push(changes): كتابة المستندات في users/{uid}/{table}/{id} مع updatedAt
 *      - pull(since): قراءة المستندات التي updatedAt > since ودمجها (آخر تعديل يفوز)
 *   3. سجّله في AppProvider بدل localOnlyAdapter، دون تغيير أي شاشة أخرى،
 *      لأن كل الكتابات تمر عبر Store في db.ts.
 */
import type { TableName, Tables } from './db';

export interface Change<T extends TableName = TableName> {
  table: T;
  op: 'put' | 'delete';
  key: string;
  value?: Tables[T];
  at: number;
}

export interface SyncAdapter {
  id: string;
  enabled: boolean;
  signIn(): Promise<{ uid: string; name: string } | null>;
  signOut(): Promise<void>;
  push(changes: Change[]): Promise<void>;
  pull(since: number): Promise<Change[]>;
}

export const localOnlyAdapter: SyncAdapter = {
  id: 'local',
  enabled: false,
  signIn: async () => null,
  signOut: async () => {},
  push: async () => {},
  pull: async () => [],
};
