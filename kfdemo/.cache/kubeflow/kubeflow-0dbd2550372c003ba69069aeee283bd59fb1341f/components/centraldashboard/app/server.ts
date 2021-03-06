import {KubeConfig} from '@kubernetes/client-node';
import express from 'express';
import {resolve} from 'path';

import {Api} from './api';
import {attachUser} from './attach_user_middleware';
import {DefaultApi} from './clients/profile_controller';
import {WorkgroupApi} from './api_workgroup';
import {KubernetesService} from './k8s_service';
import {getMetricsService} from './metrics_service_factory';

/* PROFILES_KFAM env vars will be set by Kubernetes if the Kfam service is
 * available
 * https://kubernetes.io/docs/concepts/containers/container-environment-variables/#cluster-information
 * When developing locally kubectl port-forward services/profiles-kfam
 * <localport>:8081 can be used and the environment variables set before
 * starting the server.
 */
const {
  PORT_1 = 8082,
  PROFILES_KFAM_SERVICE_HOST = 'localhost',
  PROFILES_KFAM_SERVICE_PORT = '8084',
  USERID_HEADER = 'X-Goog-Authenticated-User-Email',
  USERID_PREFIX = 'accounts.google.com:',
} = process.env;


async function main() {
  const port: number = Number(PORT_1);
  const frontEnd: string = resolve(__dirname, 'public');
  const profilesServiceUrl =
      `http://${PROFILES_KFAM_SERVICE_HOST}:${PROFILES_KFAM_SERVICE_PORT}/kfam`;

  const app: express.Application = express();
  const k8sService = new KubernetesService(new KubeConfig());
  const metricsService = await getMetricsService(k8sService);
  console.info(`Using Profiles service at ${profilesServiceUrl}`);
  const profilesService = new DefaultApi(profilesServiceUrl);
  const workgroupApi = new WorkgroupApi(profilesService);

  app.use(express.json());
  app.use(express.static(frontEnd));
  app.use(attachUser(USERID_HEADER, USERID_PREFIX));
  app.use(
      '/api', new Api(k8sService, workgroupApi, metricsService).routes());
  app.get('/*', (_: express.Request, res: express.Response) => {
    res.sendFile(resolve(frontEnd, 'index.html'));
  });
  app.listen(
      port,
      () => console.info(`Server listening on port http://localhost:${port}`));
}

main();
