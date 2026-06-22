import { HttpException, HttpStatus, Injectable, Logger } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { GetAuthDto } from "./dto/getAuth.dto";
import { PrismaService } from "src/services/prisma.service";
import * as bcrypt from 'bcrypt';

@Injectable()
export class AuthService {
    constructor(
        private jwtService: JwtService,
        private readonly prisma: PrismaService,
    ) { }
    private readonly logger = new Logger(AuthService.name);

    async login(body: GetAuthDto): Promise<{ token: string}> {
        this.logger.log(`Autenticando usuario: ${body.LOGIN}`);
        
        const user = await this.prisma.usuarios.findUnique({
            where: {
                LOGIN: body.LOGIN,
            }, select: {
                CODUSU: true,
                LOGIN: true,
                SENHA: true,
            }
        });
    
        if (!user) {
            throw new HttpException(
            'Credenciais inválidas ou usuário não encontrado!',
            HttpStatus.NOT_FOUND,
          );
        }

        const isPasswordValid = await bcrypt.compare(body.SENHA, user.SENHA);

        if (!isPasswordValid) {
            this.logger.warn(`Tentativa de login falha: Senha inválida para o usuário '${body.LOGIN}'.`);
            throw new HttpException(
                'Credenciais inválidas.', 
                HttpStatus.UNAUTHORIZED,
            );
        }
        
        const token = await this.jwtService.signAsync(user);

        return {
            token: token,
        };
    }
}  