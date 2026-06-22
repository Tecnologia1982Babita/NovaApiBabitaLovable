export interface IUsuario {
    CODUSU: Number;
    CODCLI: Number;
    LOGIN: String;
    CODEMP: Number;
    CLIENTE: {
        NOME: String;
        SOBRENOME: String;
        CPFCNPJ: String;
        EMAIL: String;
    }
    EMPRESA: {
        RAZAOSOCIAL: string;
        CPFCNPJ: string;
    }
}