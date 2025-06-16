#!/bin/bash
echo 'export DOCKER_HOST="tcp://192.168.11.252:2375"' >> ~/.bashrc
source ~/.bashrc
docker-compose up --build frontend-builder
docker-compose restart frontend