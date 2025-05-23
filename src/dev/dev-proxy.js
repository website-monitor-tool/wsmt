import browserSyncModule from 'browser-sync';
const browserSync = browserSyncModule.create();

browserSync.init({
  proxy: 'http://localhost:1010',
  files: ['build/view/**'],
  open: false,
  port: 2020,
  notify: false
});
