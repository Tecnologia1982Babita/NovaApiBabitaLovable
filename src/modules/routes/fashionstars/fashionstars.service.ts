import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/services/prisma.service';
import { IUsuario } from '../../global/usuario.entity';

@Injectable()
export class FashionstarsService {
  constructor(private prisma: PrismaService) {}

    async findAll() {
    
        const fahionstars = await this.prisma.adfashionstars.findMany({
            where: {   
                ativo: 'S',
            },
            orderBy: {
                id: 'asc',
            },
        });

        return fahionstars;
    }

    async findOne(cpfcnpj: string) {
        if (!cpfcnpj) {
            throw new BadRequestException('cpfcnpj é obrigatório');
        }

        const fashionstar = await this.prisma.adfashionstars.findFirst({
            where: {
            cpfcnpj: String(cpfcnpj),
            },
        });

        if (!fashionstar) {
            throw new NotFoundException('Cliente não encontrado');
        }

        // 🔹 Normaliza CPF/CNPJ
        if (fashionstar.cpfcnpj) {
            fashionstar.cpfcnpj = fashionstar.cpfcnpj.replace(/\D/g, '');
        }

        // 🔹 Função pra formatar data
        const formatDate = (date: Date | null) => {
            return date ? new Date(date).toLocaleDateString('pt-BR') : null;
        };

        // 🔹 Cálculo (garantindo números)
        const pontos = Number(fashionstar.pontosfashion) || 0;
        const compra7 = Number(fashionstar.compra7mes) || 0;
        const mesAtual = Number(fashionstar.mesatual) || 0;

        const saldoAtual = pontos - compra7 + mesAtual;

        // 🔹 Retorno formatado
        return {
            ...fashionstar,

            datainc: formatDate(fashionstar.datainc),
            dataalt: formatDate(fashionstar.dataalt),
            dtnasc: formatDate(fashionstar.dtnasc),
            dtiniplano: formatDate(fashionstar.dtiniplano),
            dtfimplano: formatDate(fashionstar.dtfimplano),
            saldoAtual, // 🔥 novo campo calculado
        };
    }
}
