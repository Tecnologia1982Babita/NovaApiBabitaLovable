export class FormatTools {
  formatCamelCase(str: string): string {
    return str.toLowerCase().replace(/\b\w/g, function (word) {
      return word.toUpperCase();
    });
  }

  formatCNPJ(input: string): string | null {
    try {
      const cnpjRegex = /^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/;

      const match = input.replace(/\D/g, '').match(cnpjRegex);

      if (match) {
        return `${match[1]}.${match[2]}.${match[3]}/${match[4]}-${match[5]}`;
      }

      return input;
    } catch (error) {
      throw new Error(error);
    }
  }

  formatCPF(input: string): string | null {
    try {
      const cpfRegex = /^(\d{3})(\d{3})(\d{3})(\d{2})$/;

      const match = input.match(cpfRegex);

      if (match) {
        return `${match[1]}.${match[2]}.${match[3]}-${match[4]}`;
      }

      return input;
    } catch (error) {
      throw new Error(error);
    }
  }
/*
  formatBothCPFnCNPJ(input: string): string {
    try {
      if (input.length <= 14) {
        return this.formatCPF(input);
      } else {
        return this.formatCNPJ(input);
      }
    } catch (error) {
      // throw new Error(error);
    }
  }*/
}
