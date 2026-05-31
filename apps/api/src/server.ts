import { app } from './app';
import { env } from './config/env';
import { pdfGenerationWorker } from './jobs/pdf-generation.job';

app.listen(env.API_PORT, () => {
  console.log(
    `Absolute Ice Cream API foundation running on port ${env.API_PORT} in ${env.NODE_ENV} mode`,
  );
});

if (pdfGenerationWorker) {
  console.log('PDF generation worker initialized.');
}
