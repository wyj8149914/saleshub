# =====================================================================
# deploy.ps1
#
# 作用：
#   本地 Windows 自动部署前后端项目到 Linux 服务器。
#
# 支持命令：
#   .\deploy.ps1 frontend   # 只部署前端
#   .\deploy.ps1 backend    # 只部署后端
#   .\deploy.ps1 all        # 前端 + 后端一起部署
#
# 依赖：
#   本机需要有：
#     - ssh
#     - scp
#     - tar
#     - npm，如果部署前端
#
#   服务器需要有：
#     - tar
#     - curl，如果健康检查使用 curl
#     - docker
#
# 部署逻辑：
#   前端：
#     1. 本地 npm ci
#     2. 本地 npm run build
#     3. 打包 dist 目录
#     4. scp 上传到服务器
#     5. 备份服务器旧前端文件
#     6. 解压新前端文件到 Nginx 目录
#     7. 可选重启前端 Nginx 容器
#
#   后端：
#     1. 打包后端代码
#     2. scp 上传到服务器
#     3. 备份服务器旧后端代码
#     4. 解压新后端代码
#     5. 可选在服务器执行依赖安装或构建
#     6. 重启后端 Docker 容器
#     7. 健康检查
#     8. 健康检查失败自动回滚
# =====================================================================

# ---------------------------------------------------------------------
# 命令行参数
#
# $Target 只允许传三个值：
#   frontend
#   backend
#   all
#
# 默认值是 all。
# ---------------------------------------------------------------------
param(
    [ValidateSet("frontend", "backend", "all")]
    [string]$Target = "all"
)

# ---------------------------------------------------------------------
# PowerShell 错误处理策略
#
# Stop 表示：
#   一旦 PowerShell 命令发生错误，立即停止脚本。
# ---------------------------------------------------------------------
$ErrorActionPreference = "Stop"

# =====================================================================
# 配置区
#
# 你需要重点修改这里。
# 不熟悉脚本时，先只改这里，不要改下面的函数。
# =====================================================================

# ---------------------------------------------------------------------
# SSH 服务器别名
#
# 推荐你先在本机配置 SSH 别名：
#   C:\Users\你的用户名\.ssh\config
#
# 示例：
#   Host myapp
#       HostName 123.123.123.123
#       User deploy
#       Port 22
#       IdentityFile C:\Users\你的用户名\.ssh\id_ed25519_deploy
#
# 配置好后，这里就写：
#   $Server = "myapp"
#
# 如果你没有配置 SSH 别名，也可以写：
#   $Server = "deploy@123.123.123.123"
# ---------------------------------------------------------------------
$Server = "myapp"

# ---------------------------------------------------------------------
# Docker 命令
#
# 如果服务器上 deploy 用户已经加入 docker 用户组：
#   $DockerCmd = "docker"
#
# 如果 deploy 用户没有 docker 权限，但允许 sudo 执行 docker：
#   $DockerCmd = "sudo docker"
# ---------------------------------------------------------------------
$DockerCmd = "docker"

# ---------------------------------------------------------------------
# 前端源码目录
#
# 这个目录是执行 npm ci / npm run build 的目录。
#
# 如果前端项目就在当前项目根目录：
#   $FrontendSourceDir = "."
#
# 如果前端代码在 frontend 子目录：
#   $FrontendSourceDir = "frontend"
# ---------------------------------------------------------------------
$FrontendSourceDir = "frontend"

# ---------------------------------------------------------------------
# 前端构建产物目录
#
# 例如 Vite / Webpack / React / Vue 打包后生成 dist。
#
# 如果前端在根目录，构建产物是 dist：
#   $FrontendBuildDir = "dist"
#
# 如果前端在 frontend 目录，构建产物是 frontend/dist：
#   $FrontendBuildDir = "frontend/dist"
# ---------------------------------------------------------------------
$FrontendBuildDir = "frontend/dist"

# ---------------------------------------------------------------------
# 服务器上的前端静态文件目录
#
# 这个目录应该对应你的 Nginx 站点根目录。
#
# 例如 Nginx 配置里有：
#   root /var/www/frontend;
#
# 那么这里就写：
#   $FrontendRemoteDir = "/var/www/frontend"
# ---------------------------------------------------------------------
$FrontendRemoteDir = "/var/www/frontend"

# ---------------------------------------------------------------------
# 前端容器名
#
# 如果你的前端静态文件是由一个 Nginx 容器提供服务，
# 并且替换静态文件后需要重启这个容器，就填容器名。
#
# 例如：
#   $FrontendContainer = "nginx"
#
# 如果前端由宿主机 Nginx 提供服务，
# 或者只是替换静态文件不需要重启，则留空：
#   $FrontendContainer = ""
# ---------------------------------------------------------------------
$FrontendContainer = ""

# ---------------------------------------------------------------------
# 后端源码目录
#
# 本地后端代码目录。
#
# 例如后端代码在 backend 子目录：
#   $BackendSourceDir = "backend"
#
# 如果后端就在项目根目录：
#   $BackendSourceDir = "."
# ---------------------------------------------------------------------
$BackendSourceDir = "backend"

# ---------------------------------------------------------------------
# 服务器上的后端代码目录
#
# 如果你的 Docker 容器挂载了宿主机目录运行后端代码，
# 这里必须填写容器实际挂载的宿主机目录。
#
# 例如容器启动时有：
#   -v /opt/app/backend:/app
#
# 那么这里写：
#   $BackendRemoteDir = "/opt/app/backend"
# ---------------------------------------------------------------------
$BackendRemoteDir = "/opt/app/backend"

# ---------------------------------------------------------------------
# 服务器备份目录
#
# 每次部署前，脚本会把服务器上的旧代码备份到这里。
#
# 例如：
#   /opt/app/backups/frontend
#   /opt/app/backups/backend
# ---------------------------------------------------------------------
$BackupDir = "/opt/app/backups"

# ---------------------------------------------------------------------
# 后端 Docker 容器名
#
# 必须和服务器上实际运行的后端容器名一致。
#
# 查看方式：
#   ssh myapp "docker ps"
#
# 如果后端容器名叫 backend：
#   $BackendContainer = "backend"
# ---------------------------------------------------------------------
$BackendContainer = "backend"

# ---------------------------------------------------------------------
# 是否使用 Docker Compose 管理后端
#
# 如果你的后端是通过 docker-compose.yml 管理的，设置为：
#   $UseCompose = $true
#
# 如果你的后端只是普通 docker run 出来的容器，设置为：
#   $UseCompose = $false
# ---------------------------------------------------------------------
$UseCompose = $false

# ---------------------------------------------------------------------
# Docker Compose 配置
#
# 只有当 $UseCompose = $true 时才需要配置。
#
# $ComposeDir：
#   服务器上 docker-compose.yml 所在目录。
#
# $ComposeService：
#   docker-compose.yml 里面后端服务的名字。
#
# 例如 docker-compose.yml 在 /opt/app/docker-compose.yml：
#   services:
#     backend:
#       image: node:20
#
# 那么：
#   $ComposeDir = "/opt/app"
#   $ComposeService = "backend"
# ---------------------------------------------------------------------
$ComposeDir = "/opt/app"
$ComposeService = "backend"

# ---------------------------------------------------------------------
# 后端远程构建命令
#
# 后端代码上传到服务器后，是否需要在服务器上执行构建或安装依赖。
#
# 如果你的后端是 Node.js，并且服务器需要安装依赖：
#   $RemoteBackendBuildCmd = "cd /opt/app/backend && npm ci --omit=dev"
#
# 如果还需要构建：
#   $RemoteBackendBuildCmd = "cd /opt/app/backend && npm ci && npm run build"
#
# 如果后端代码本地已经构建完成，服务器只需要重启容器：
#   $RemoteBackendBuildCmd = ""
# ---------------------------------------------------------------------
$RemoteBackendBuildCmd = ""

# ---------------------------------------------------------------------
# 健康检查命令
#
# 后端容器重启后，脚本会循环执行这个命令。
# 如果命令返回 0，就认为后端启动成功。
#
# 推荐后端提供一个 /health 接口。
#
# 例如后端监听 8000 端口：
#   $HealthCheckCmd = "curl -fsS http://127.0.0.1:8000/health"
#
# 如果服务器没有 curl，可以用 wget：
#   $HealthCheckCmd = "wget -qO- http://127.0.0.1:8000/health"
# ---------------------------------------------------------------------
$HealthCheckCmd = "curl -fsS http://127.0.0.1:8000/health"

# =====================================================================
# 下面是脚本函数区
#
# 如果你不熟悉 PowerShell，可以先不改这里。
# =====================================================================

# ---------------------------------------------------------------------
# 打印普通日志
#
# 用法：
#   Write-Log "开始部署"
# ---------------------------------------------------------------------
function Write-Log {
    param(
        [string]$Message
    )

    # 绿色输出日志，带当前时间
    Write-Host "[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] $Message" -ForegroundColor Green
}

# ---------------------------------------------------------------------
# 打印错误日志
#
# 用法：
#   Write-Err "部署失败"
# ---------------------------------------------------------------------
function Write-Err {
    param(
        [string]$Message
    )

    # 红色输出错误日志
    Write-Host "[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] ERROR: $Message" -ForegroundColor Red
}

# ---------------------------------------------------------------------
# 检查本机是否存在某个命令
#
# 用法：
#   Test-Command "ssh"
#
# 返回值：
#   true  存在
#   false 不存在
# ---------------------------------------------------------------------
function Test-Command {
    param(
        [string]$Command
    )

    # Get-Command 可以查找命令是否存在
    # -ErrorAction SilentlyContinue 表示找不到时不报错
    return [bool](Get-Command $Command -ErrorAction SilentlyContinue)
}

# ---------------------------------------------------------------------
# 在服务器执行远程命令
#
# 用法：
#   Invoke-Remote "docker ps"
#
# 说明：
#   如果远程命令执行失败，会直接抛出错误并终止脚本。
# ---------------------------------------------------------------------
function Invoke-Remote {
    param(
        [string]$Command
    )

    # Windows PowerShell 里的字符串可能是 CRLF 换行。
    # Linux Shell 更适应 LF 换行，所以这里把 CRLF 替换成 LF。
    $Command = $Command -replace "`r`n", "`n"

    # 通过 SSH 到服务器执行命令
    ssh $Server $Command

    # $LASTEXITCODE 是上一个外部命令的退出码。
    # 0 表示成功，非 0 表示失败。
    if ($LASTEXITCODE -ne 0) {
        throw "远程命令执行失败，请查看上方输出。"
    }
}

# ---------------------------------------------------------------------
# 测试远程命令是否执行成功
#
# 用法：
#   Test-Remote "curl -fsS http://127.0.0.1:8000/health"
#
# 返回值：
#   true  成功
#   false 失败
#
# 说明：
#   这个函数不会让脚本终止，只用于判断成功或失败。
#   主要给健康检查使用。
# ---------------------------------------------------------------------
function Test-Remote {
    param(
        [string]$Command
    )

    # 同样把 CRLF 转成 LF
    $Command = $Command -replace "`r`n", "`n"

    # *> $null 表示隐藏命令输出，避免健康检查刷屏
    ssh $Server $Command *> $null

    # 返回是否成功
    return ($LASTEXITCODE -eq 0)
}

# ---------------------------------------------------------------------
# 环境检查
#
# 检查：
#   1. 本机是否有 ssh / scp / tar
#   2. 如果部署前端，是否有 npm
#   3. 是否能 SSH 连接服务器
# ---------------------------------------------------------------------
function Precheck {
    Write-Log "开始环境检查"

    # 这些是本机必须存在的命令
    foreach ($cmd in @("ssh", "scp", "tar")) {
        if (-not (Test-Command $cmd)) {
            throw "本机缺少命令: $cmd，请先安装对应工具。"
        }
    }

    # 只有部署前端时才强制要求 npm
    if ($Target -eq "frontend" -or $Target -eq "all") {
        if (-not (Test-Command "npm")) {
            throw "本机缺少 npm，请先安装 Node.js。"
        }
    }

    # 测试 SSH 是否能连接服务器
    if (-not (Test-Remote "echo ok")) {
        throw "SSH 连接失败: $Server，请检查 SSH 配置、密钥、服务器 IP、端口。"
    }

    Write-Log "环境检查通过"
}

# ---------------------------------------------------------------------
# 获取临时打包目录
#
# 脚本会在项目根目录创建：
#   .deploy
#
# 用于临时存放：
#   frontend.tar.gz
#   backend.tar.gz
# ---------------------------------------------------------------------
function Get-TempDir {
    # $PSScriptRoot 表示 deploy.ps1 所在目录
    $dir = Join-Path $PSScriptRoot ".deploy"

    # 如果目录不存在则创建
    New-Item -ItemType Directory -Force -Path $dir | Out-Null

    return $dir
}

# ---------------------------------------------------------------------
# 构建前端
#
# 默认执行：
#   npm ci
#   npm run build
#
# 如果你使用 pnpm / yarn，需要自己修改这里。
# ---------------------------------------------------------------------
function Build-Frontend {
    # 拼接前端源码目录完整路径
    $frontendPath = Join-Path $PSScriptRoot $FrontendSourceDir

    # 判断目录是否存在
    if (-not (Test-Path $frontendPath)) {
        throw "前端目录不存在: $frontendPath"
    }

    # 进入前端目录
    Push-Location $frontendPath

    try {
        # npm ci：
        # 根据 package-lock.json 安装依赖，比 npm install 更稳定。
        Write-Log "执行 npm ci"
        npm ci

        # 如果 npm ci 失败，终止脚本
        if ($LASTEXITCODE -ne 0) {
            throw "npm ci 失败"
        }

        # npm run build：
        # 执行前端打包命令。
        Write-Log "执行 npm run build"
        npm run build

        # 如果打包失败，终止脚本
        if ($LASTEXITCODE -ne 0) {
            throw "npm run build 失败"
        }
    }
    finally {
        # 无论成功失败，都退回原目录
        Pop-Location
    }
}

# ---------------------------------------------------------------------
# 部署前端
#
# 流程：
#   1. 构建前端
#   2. 打包构建产物
#   3. 上传到服务器 /tmp
#   4. 备份服务器旧前端文件
#   5. 清空服务器前端目录
#   6. 解压新前端文件
#   7. 设置目录可读权限
#   8. 可选重启前端容器
# ---------------------------------------------------------------------
function Deploy-Frontend {
    Write-Log "开始部署前端"

    # 1. 构建前端
    Build-Frontend

    # 2. 获取前端构建产物目录，例如 frontend/dist
    $buildPath = Join-Path $PSScriptRoot $FrontendBuildDir

    # 如果构建目录不存在，说明打包失败或配置错误
    if (-not (Test-Path $buildPath)) {
        throw "前端构建目录不存在: $buildPath"
    }

    # 3. 准备本地临时打包目录
    $tempDir = Get-TempDir
    $localTar = Join-Path $tempDir "frontend.tar.gz"

    # 如果上次打包文件还在，先删除
    if (Test-Path $localTar) {
        Remove-Item $localTar -Force
    }

    # Windows 路径使用反斜杠 \
    # tar 更适合使用正斜杠 /
    # 所以这里把 \ 替换成 /
    $buildPathUnix = $buildPath -replace '\\', '/'

    # 4. 打包前端构建产物
    #
    # tar 参数说明：
    #   -c      创建压缩包
    #   -z      使用 gzip 压缩
    #   -f      指定压缩文件名
    #   -C      切换到指定目录后再打包
    #   .       打包当前目录下的所有文件
    Write-Log "打包前端: $buildPath"
    tar -czf $localTar -C $buildPathUnix .

    # 如果打包失败，终止脚本
    if ($LASTEXITCODE -ne 0) {
        throw "前端打包失败"
    }

    # 5. 生成服务器临时文件名
    #
    # 使用时间戳避免文件名冲突。
    $stamp = Get-Date -Format "yyyyMMddHHmmss"
    $remoteTar = "/tmp/deploy_frontend_$stamp.tar.gz"

    # 6. 上传压缩包到服务器
    Write-Log "上传前端包到服务器"
    scp $localTar "${Server}:${remoteTar}"

    # 如果上传失败，终止脚本
    if ($LASTEXITCODE -ne 0) {
        throw "前端包上传失败"
    }

    # 7. 在服务器执行备份、清理、解压
    Write-Log "备份并部署前端"

    # 这一段是发送到 Linux 服务器执行的 Shell 命令。
    # @" 和 "@ 之间是多行字符串。
    #
    # Shell 命令说明：
    #   set -e：
    #       任何一条命令失败，立即退出。
    #
    #   mkdir -p '$BackupDir'：
    #       创建备份目录。
    #
    #   rm -rf '$BackupDir/frontend'：
    #       删除上一次前端备份。
    #
    #   cp -a：
    #       复制目录并保留权限、时间等属性。
    #
    #   find ... -mindepth 1 -maxdepth 1 -exec rm -rf {} +：
    #       清空前端目录里的所有文件，但保留 frontend 目录本身。
    #
    #   tar -xzf：
    #       解压压缩包。
    #
    #   chmod -R a+rX：
    #       让 Nginx 用户可以读取静态文件。
    $remoteCommand = @"
set -e

mkdir -p '$BackupDir'
rm -rf '$BackupDir/frontend'

if [ -d '$FrontendRemoteDir' ]; then
    cp -a '$FrontendRemoteDir' '$BackupDir/frontend'
fi

mkdir -p '$FrontendRemoteDir'

find '$FrontendRemoteDir' -mindepth 1 -maxdepth 1 -exec rm -rf {} +

tar -xzf '$remoteTar' -C '$FrontendRemoteDir'
rm -f '$remoteTar'

chmod -R a+rX '$FrontendRemoteDir'
"@

    # 执行远程 Shell 命令
    Invoke-Remote $remoteCommand

    # 8. 如果配置了前端容器，则重启前端容器
    if ($FrontendContainer) {
        Write-Log "重启前端容器: $FrontendContainer"
        Invoke-Remote "$DockerCmd restart '$FrontendContainer'"
    }

    Write-Log "前端部署完成"
}

# ---------------------------------------------------------------------
# 重启后端容器
#
# 如果 $UseCompose = $true：
#   使用 docker compose up -d --force-recreate
#
# 如果 $UseCompose = $false：
#   使用 docker restart
# ---------------------------------------------------------------------
function Restart-Backend {
    if ($UseCompose) {
        Write-Log "使用 Docker Compose 重启后端: $ComposeService"

        # cd 到 compose 文件所在目录，然后重启指定服务。
        #
        # 参数说明：
        #   up -d：
        #       后台启动服务。
        #   --force-recreate：
        #       强制重新创建容器。
        #   --no-deps：
        #       不重启依赖服务，例如 PG / Redis。
        Invoke-Remote "cd '$ComposeDir' && $DockerCmd compose up -d --force-recreate --no-deps '$ComposeService'"
    }
    else {
        Write-Log "重启后端容器: $BackendContainer"

        # 普通 Docker 容器直接 restart
        Invoke-Remote "$DockerCmd restart '$BackendContainer'"
    }
}

# ---------------------------------------------------------------------
# 查看后端最近日志
#
# 当健康检查失败时，会调用这个函数。
# 方便你直接看到后端为什么启动失败。
# ---------------------------------------------------------------------
function Show-BackendLogs {
    Write-Log "查看后端最近日志"

    if ($UseCompose) {
        # Docker Compose 查看服务日志
        ssh $Server "cd '$ComposeDir' && $DockerCmd compose logs --tail=100 '$ComposeService'"
    }
    else {
        # 普通 Docker 容器查看日志
        ssh $Server "$DockerCmd logs --tail=100 '$BackendContainer'"
    }
}

# ---------------------------------------------------------------------
# 回滚后端
#
# 如果新后端代码启动失败：
#   1. 删除当前后端目录
#   2. 恢复备份目录
#   3. 重启后端容器
# ---------------------------------------------------------------------
function Rollback-Backend {
    Write-Log "开始回滚后端"

    # 远程 Shell 命令：
    #   如果备份目录存在，就恢复备份。
    #   如果不存在，则报错退出。
    $remoteCommand = @"
set -e

if [ -d '$BackupDir/backend' ]; then
    rm -rf '$BackendRemoteDir'
    cp -a '$BackupDir/backend' '$BackendRemoteDir'
else
    echo '没有找到后端备份目录，无法回滚' >&2
    exit 1
fi
"@

    # 执行恢复命令
    Invoke-Remote $remoteCommand

    # 恢复旧代码后，再次重启后端容器
    Restart-Backend

    Write-Log "后端已回滚，请手动验证"
}

# ---------------------------------------------------------------------
# 部署后端
#
# 流程：
#   1. 打包本地后端代码
#   2. 上传到服务器 /tmp
#   3. 备份服务器旧后端代码
#   4. 清空服务器后端目录
#   5. 解压新后端代码
#   6. 可选执行远程构建 / 安装依赖
#   7. 重启后端容器
#   8. 健康检查
#   9. 失败则查看日志并回滚
# ---------------------------------------------------------------------
function Deploy-Backend {
    Write-Log "开始部署后端"

    # 1. 获取本地后端目录完整路径
    $sourcePath = Join-Path $PSScriptRoot $BackendSourceDir

    # 判断目录是否存在
    if (-not (Test-Path $sourcePath)) {
        throw "后端目录不存在: $sourcePath"
    }

    # 2. 准备本地临时打包文件
    $tempDir = Get-TempDir
    $localTar = Join-Path $tempDir "backend.tar.gz"

    # 删除旧包
    if (Test-Path $localTar) {
        Remove-Item $localTar -Force
    }

    # 路径转换为 tar 友好的正斜杠格式
    $sourcePathUnix = $sourcePath -replace '\\', '/'

    # 3. 打包后端代码
    #
    # 排除内容说明：
    #   .git：
    #       Git 版本库，不需要上传。
    #
    #   node_modules：
    #       Node 依赖目录，不建议从 Windows 上传到 Linux。
    #       如果服务器需要依赖，建议配置 $RemoteBackendBuildCmd。
    #
    #   .env / .env.*：
    #       环境变量和密钥文件，不应该通过部署脚本覆盖。
    Write-Log "打包后端: $sourcePath"
    tar -czf $localTar --exclude=".git" --exclude="node_modules" --exclude=".env" --exclude=".env.*" -C $sourcePathUnix .

    # 打包失败则终止
    if ($LASTEXITCODE -ne 0) {
        throw "后端打包失败"
    }

    # 4. 生成服务器临时文件名
    $stamp = Get-Date -Format "yyyyMMddHHmmss"
    $remoteTar = "/tmp/deploy_backend_$stamp.tar.gz"

    # 5. 上传后端压缩包
    Write-Log "上传后端包到服务器"
    scp $localTar "${Server}:${remoteTar}"

    # 上传失败则终止
    if ($LASTEXITCODE -ne 0) {
        throw "后端包上传失败"
    }

    # 6. 在服务器执行备份、清理、解压
    Write-Log "备份并部署后端"

    # Shell 命令说明：
    #   mkdir -p '$BackupDir'：
    #       创建备份目录。
    #
    #   rm -rf '$BackupDir/backend'：
    #       删除上一次后端备份。
    #
    #   cp -a '$BackendRemoteDir' '$BackupDir/backend'：
    #       把当前服务器后端代码完整备份。
    #
    #   find ... -exec rm -rf {} +：
    #       清空后端目录，但保留目录本身。
    #
    #   tar -xzf：
    #       解压新后端代码。
    $remoteCommand = @"
set -e

mkdir -p '$BackupDir'
rm -rf '$BackupDir/backend'

if [ -d '$BackendRemoteDir' ]; then
    cp -a '$BackendRemoteDir' '$BackupDir/backend'
fi

mkdir -p '$BackendRemoteDir'

find '$BackendRemoteDir' -mindepth 1 -maxdepth 1 -exec rm -rf {} +

tar -xzf '$remoteTar' -C '$BackendRemoteDir'
rm -f '$remoteTar'
"@

    # 执行远程部署命令
    Invoke-Remote $remoteCommand

    # 7. 如果配置了远程构建 / 安装依赖，则执行
    if ($RemoteBackendBuildCmd) {
        Write-Log "执行服务器端后端构建/依赖安装"
        Invoke-Remote $RemoteBackendBuildCmd
    }

    # 8. 重启后端容器
    Restart-Backend

    # 9. 健康检查
    Write-Log "开始健康检查"

    # 健康检查最多尝试 30 次。
    # 每次间隔 2 秒，也就是最多约 60 秒。
    $healthy = $false

    for ($i = 1; $i -le 30; $i++) {
        # Test-Remote 返回 true 表示健康检查成功
        if (Test-Remote $HealthCheckCmd) {
            $healthy = $true
            break
        }

        # 等待 2 秒后重试
        Start-Sleep -Seconds 2
    }

    # 根据健康检查结果处理
    if ($healthy) {
        Write-Log "后端部署成功"
    }
    else {
        Write-Err "后端健康检查失败"

        # 输出后端最近日志，方便排查问题
        Show-BackendLogs

        # 自动回滚到旧版本
        Rollback-Backend

        # 终止脚本
        throw "后端部署失败，已自动回滚"
    }
}

# =====================================================================
# 主流程
#
# 根据用户传入的 $Target 决定执行哪个部署。
# =====================================================================

# 先做环境检查
Precheck

# 根据参数执行对应部署
switch ($Target) {
    "frontend" {
        Deploy-Frontend
    }

    "backend" {
        Deploy-Backend
    }

    "all" {
        Deploy-Frontend
        Deploy-Backend
    }
}

# 全部执行完成后提示
Write-Log "部署流程结束，目标: $Target"