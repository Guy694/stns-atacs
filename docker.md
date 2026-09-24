# 3. STN TREE
  # http://127.0.0.1:3000
  # =========================================================
  stn-tree-app:
    build:
      context: ../stn-tree
      dockerfile: Dockerfile

    container_name: stn-tree-app
    restart: always

    depends_on:
      - db

    environment:
      DB_HOST: db
      DB_PORT: 3306
      DB_USER: root
      DB_PASSWORD: ${MYSQL_ROOT_PASSWORD}

      DB_NAME: stn_tree_db
      DATABASE_URL: mysql://root:${MYSQL_ROOT_PASSWORD}@db:3306/stn_tree_db

      NEXT_PUBLIC_BASE_PATH: /stn-tree
      NODE_ENV: ${NODE_ENV}

    ports:
      - "127.0.0.1:3000:3000"

    volumes:
      # - ../stn-tree/public/uploads:/app/public/uploads
      - ./public/uploads:/app/public/uploads

    networks:
      - stn-network





      # =========================================================
  # 5. STN ATACS
  # http://127.0.0.1:3003
  # =========================================================
  stn-atacs-app:
    build:
      context: ../stns-atacs
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

      NEXT_PUBLIC_BASE_PATH: /stns-atacs
      NODE_ENV: ${NODE_ENV}

    ports:
      - "127.0.0.1:3003:3000"

    volumes:
      - ../stns-atacs/public/uploads:/app/public/uploads

    networks:
      - stn-network