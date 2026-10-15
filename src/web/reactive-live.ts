import * as store from '../resume/reactive-connection-store';
import { listInstanceResumes } from '../resume/reactive-resume-api';
import { reachable } from '../resume/reactive-resume-url';
import { isAdmin } from '../users/admin-policy';
import { currentUser } from './current-user';
import { createReactiveResumeRoute } from './routes/reactive-resume';

/** The Reactive Resume card's routes wired to the real instance, the real database and the person making the request (ADR 0075). */
export const reactiveResumeRoute = createReactiveResumeRoute({
  store,
  list: listInstanceResumes,
  reach: reachable,
  userId: () => currentUser().id,
  mayReachInward: () => isAdmin(currentUser()),
});
