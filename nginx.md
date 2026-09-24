 # =========================================================
  # 5. nginx STN ATACS
  # http://127.0.0.1:3003
  # =========================================================
  stn-atacs-app:
    build:
      context: ../stn-atacs
      dockerfile: Dockerfile

    container_name: stn-atacs-app
    restart: always

    depends_on:
      - db

    environment:
      DB_HOST: db
      DB_PORT: 3306
      DB_USER: root
      DB_PASSWORD: ${MYSQL_ROOT_PASSWORD}

      DB_NAME: stn_atacs
      DATABASE_URL: mysql://root:${MYSQL_ROOT_PASSWORD}@db:3306/stn_atacs

      NEXT_PUBLIC_BASE_PATH: /stn-atacs
      NODE_ENV: ${NODE_ENV}

    ports:
      - "127.0.0.1:3003:3000"

    volumes:
      - ../stn-atacs/public/uploads:/app/public/uploads

    networks:
      - stn-network






# ================= reverse_proxy  STN-atacs ==========================
   location = /stns-atacs {

        return 301 $scheme://$http_host/stns-atacs/;
    }

    location /stns-atacs/ {

        proxy_pass http://203.157.238.51;

        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";

        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        #
        proxy_set_header X-Forwarded-Host $host;

        # สำหรับจัดเก็บไฟล์ขนาดใหญ่ (ตามที่คุณตั้ง Body Size ไว้)
        proxy_read_timeout 300s;
        proxy_buffering off;
    }