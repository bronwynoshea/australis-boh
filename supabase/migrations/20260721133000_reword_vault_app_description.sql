begin;

update public.boh_app
set description='Store and manage passwords, service keys, certificates, and other sensitive information in one secure place.'
where slug='vault'
  and app_context='boh';

commit;
