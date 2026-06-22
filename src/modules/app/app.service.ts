import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from 'src/services/prisma.service';
import { HashTools } from '../tools/hash.tool';
import { CreateSetupDto } from './dto/createSetupDto.dto';

@Injectable()
export class AppService {
  $transaction: any;
    constructor(private readonly prisma: PrismaService) {}
    private readonly logger = new Logger(AppService.name);

  async setupInicial(body: CreateSetupDto) {
    if (body.SECRET !== process.env.SETUP_SECRET) {
      throw new BadRequestException('Secret inválido.');
    }
    try {
      const cadastro = await this.prisma.$transaction(async (tx) => {
        const hashTools = new HashTools();
        const senhaHash = await hashTools.generate(body.CNPJCPF);
        
        await tx.usuarios.create({
          data: {
            LOGIN: body.EMAIL,
            SENHA: senhaHash
            },
        });
      })

      return cadastro;

    } catch (error) {
      this.logger.error('Erro ao realizar o setup inicial:', error);
      throw new BadRequestException('Erro ao realizar o setup inicial.');
    }
  }
}
