FROM nginx:1.27-alpine

RUN rm /etc/nginx/conf.d/default.conf
COPY nginx.conf /etc/nginx/conf.d/default.conf

COPY . /usr/share/nginx/html
RUN rm -f /usr/share/nginx/html/.env /usr/share/nginx/html/config.local.js \
       /usr/share/nginx/html/Dockerfile /usr/share/nginx/html/.dockerignore \
       /usr/share/nginx/html/start.sh /usr/share/nginx/html/serve.py

COPY start.sh /start.sh
RUN chmod +x /start.sh

ENV PORT=8080
EXPOSE 8080

CMD ["/start.sh"]
