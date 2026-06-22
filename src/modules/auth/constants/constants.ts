import { SetMetadata } from "@nestjs/common";   

export const jwtConstants = {
    secret: 'NÃO USE ESTE VALOR, EM VEZ DISSO, CRIE UM SEGREDO COMPLEXO E MANTENHA-O SEGURO FORA DO CÓDIGO-FONTE.'
};
export const IS_PUBLIC_KEY = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);  