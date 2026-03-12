#include<iostream>
#include<vector>
using namespace std;
int main(){
    int n = 10;
    vector< int > arr(n);
    vector< vector< int > > a(n, vector< int >(n));
    for(int i = 0; i < n; ++i){
        arr[i] = 2 * i - n;
        for(int j = 0; j < n; ++j){
            a[i][j] = i * n + j;
        }
        
    }

}